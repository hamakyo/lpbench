/**
 * Lighthouse evaluator (docs/ARCHITECTURE.md "Evaluator": Lighthouse).
 *
 * Runs Lighthouse against a served artifact URL and normalizes the report into
 * a small, stable metric set (category scores 0..1 plus web-vitals audits).
 *
 * Design rules:
 * - Lighthouse outputs are raw measurements kept SEPARATE from the quality
 *   score (docs/BENCHMARK_DESIGN.md "Efficiency is not quality").
 * - Availability is handled honestly: when Chrome cannot be launched or the
 *   run fails, the outcome is `skipped`/`failed` with a warning — numbers are
 *   never fabricated (docs/ARCHITECTURE.md evaluator states).
 * - The page is evaluated via the isolated preview-server origin; Chrome is
 *   launched headless with `--no-sandbox` for CI compatibility.
 */

import { accessSync, constants } from "node:fs";

export interface LighthouseMetricSet {
  /** Lighthouse category scores, 0..1. */
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  /** Audit timings (ms) / unit values, present only when measured. */
  lcpMs?: number;
  cls?: number;
  tbtMs?: number;
  speedIndexMs?: number;
  interactiveMs?: number;
}

export type LighthouseStatus = "ok" | "skipped" | "failed";

export interface LighthouseOutcome {
  status: LighthouseStatus;
  /** Human-readable reason when status is not ok. */
  warning?: string;
  metrics?: LighthouseMetricSet;
}

export interface LighthouseRunOptions {
  /** Overall Lighthouse run timeout, ms. Default 120000. */
  timeoutMs?: number;
  /** Explicit Chrome executable path (default: chrome-launcher discovery). */
  chromePath?: string;
}

/**
 * Pure mapping from a Lighthouse report object (lhr) to the normalized metric
 * set. Throws when the report lacks the four core categories.
 */
export function extractLighthouseMetrics(report: unknown): LighthouseMetricSet {
  if (typeof report !== "object" || report === null) {
    throw new Error("lighthouse report is not an object");
  }
  const categories = ((report as Record<string, unknown>).categories ?? {}) as Record<string, unknown>;
  const audits = ((report as Record<string, unknown>).audits ?? {}) as Record<string, unknown>;

  const categoryScore = (key: string): number => {
    const cat = categories[key] as Record<string, unknown> | undefined;
    const score = cat?.score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error(`lighthouse report missing category "${key}"`);
    }
    return score;
  };
  // CLS >= 0 is a valid measurement (0 means no layout shift), so it is kept;
  // time metrics use > 0 to avoid treating outright missing values as 0.
  const auditMs = (key: string): number | undefined => {
    const audit = audits[key] as Record<string, unknown> | undefined;
    const v = audit?.numericValue;
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const cls = (() => {
    const audit = audits["cumulative-layout-shift"] as Record<string, unknown> | undefined;
    const v = audit?.numericValue;
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  })();

  const metrics: LighthouseMetricSet = {
    performance: categoryScore("performance"),
    accessibility: categoryScore("accessibility"),
    bestPractices: categoryScore("best-practices"),
    seo: categoryScore("seo"),
  };
  const lcpMs = auditMs("largest-contentful-paint");
  const tbtMs = auditMs("total-blocking-time");
  const speedIndexMs = auditMs("speed-index");
  const interactiveMs = auditMs("interactive");
  if (lcpMs !== undefined) metrics.lcpMs = lcpMs;
  if (cls !== undefined) metrics.cls = cls;
  if (tbtMs !== undefined) metrics.tbtMs = tbtMs;
  if (speedIndexMs !== undefined) metrics.speedIndexMs = speedIndexMs;
  if (interactiveMs !== undefined) metrics.interactiveMs = interactiveMs;
  return metrics;
}

function isChromeUnavailable(message: string): boolean {
  return /chrome|executable|ENOENT|not found/i.test(message) && !/timed out/i.test(message);
}

/** Race a promise against a timeout; late rejections of `p` stay swallowed. */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  p.catch(() => {});
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`lighthouse run timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Run Lighthouse against a served artifact URL. */
export async function runLighthouseChecks(
  url: string,
  opts: LighthouseRunOptions = {}
): Promise<LighthouseOutcome> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  // An explicitly configured Chrome path that does not exist is a skip, not a
  // launch crash (avoids an uncaught spawn ENOENT).
  if (opts.chromePath) {
    try {
      accessSync(opts.chromePath, constants.X_OK);
    } catch {
      return { status: "skipped", warning: `chrome not executable at ${opts.chromePath}` };
    }
  }
  let chrome: { port: number; kill: () => void } | undefined;
  try {
    const { launch } = await import("chrome-launcher");
    const launched = await launch({
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
      ...(opts.chromePath ? { chromePath: opts.chromePath } : {}),
    });
    chrome = { port: launched.port, kill: () => void launched.kill() };
    const { default: lighthouse } = await import("lighthouse");
    const runnerResult = await withTimeout(
      lighthouse(url, {
        port: chrome.port,
        output: "json",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        logLevel: "error",
      }),
      timeoutMs
    );
    const lhr = runnerResult?.lhr;
    const metrics = lhr ? extractLighthouseMetrics(lhr) : undefined;
    if (!metrics) {
      return { status: "failed", warning: "lighthouse produced no usable report" };
    }
    return { status: "ok", metrics };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: isChromeUnavailable(message) ? "skipped" : "failed",
      warning: message,
    };
  } finally {
    if (chrome) {
      try {
        chrome.kill();
      } catch {
        // already dead
      }
    }
  }
}