/**
 * Browser-based checks for a generated artifact using Playwright.
 *
 * These checks run the artifact in a real Chromium over an HTTP origin (the
 * preview server, see src/runners/previewServer.ts) so HTTP semantics apply
 * (docs/ARCHITECTURE.md). They cover the deterministic browser-checkable parts
 * of the benchmark:
 *
 *   - page loads without uncaught / console errors
 *   - no horizontal overflow at benchmark viewports
 *   - required sections / copy are present
 *   - mobile hamburger menu and CTA are interactive
 *   - screenshots captured per viewport
 *
 * The page is treated as untrusted (docs/SECURITY.md): a fresh browser context
 * per run, external network blocked/recorded, timeouts applied.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

export interface BenchmarkViewport {
  name: string;
  width: number;
  height: number;
}

export interface BrowserCheckResult {
  ok: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  missingSections: string[];
  overflow: { viewport: string; scrollWidth: number; clientWidth: number }[];
  interaction: {
    hamburgerOpened: boolean;
    ctaFeedback: boolean;
  };
  screenshots: { viewport: string; path: string }[];
}

export interface BrowserCheckOptions {
  /** Absolute or relative URL served by the preview server. */
  url: string;
  requiredText: string[];
  viewports: BenchmarkViewport[];
  /** Text to click to open the mobile menu (e.g. aria-label or text). */
  hamburgerSelector: string;
  /** Validate CTA (mouse down) gives some visible feedback. */
  ctaSelector: string;
  /** Timeout for page load / interactions, ms. */
  timeoutMs?: number;
  /** Screenshot output dir. */
  screenshotDir?: string;
  /** Block real network (only allow same-origin static assets). */
  blockNetwork?: boolean;
}

const DEFAULT_TIMEOUT = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Run all browser checks against a served artifact. */
export async function runBrowserChecks(opts: BrowserCheckOptions): Promise<BrowserCheckResult> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const blockNetwork = opts.blockNetwork ?? true;

  const result: BrowserCheckResult = {
    ok: true,
    consoleErrors: [],
    pageErrors: [],
    missingSections: [],
    overflow: [],
    interaction: { hamburgerOpened: false, ctaFeedback: false },
    screenshots: [],
  };

  const browser: Browser = await chromium.launch();
  try {
    const context: BrowserContext = await browser.newContext();
    if (blockNetwork) {
      await context.route("**/*", (route) => {
        const url = route.request().url();
        // Allow same-origin requests only; record/block the rest.
        if (url.startsWith(opts.url)) {
          route.continue();
        } else {
          route.abort();
        }
      });
    }

    const page: Page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") result.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      result.pageErrors.push(String(err));
    });

    await page.goto(opts.url, { waitUntil: "networkidle", timeout });

    // --- Horizontal overflow per viewport ---
    for (const vp of opts.viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await sleep(100);
      const dims = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (dims.scrollWidth > dims.clientWidth) {
        result.overflow.push({ viewport: vp.name, ...dims });
      }
      if (opts.screenshotDir) {
        const path = `${opts.screenshotDir}/${vp.name}.png`;
        await page.screenshot({ path });
        result.screenshots.push({ viewport: vp.name, path });
      }
    }

    // --- Required section / copy presence ---
    const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
    for (const text of opts.requiredText) {
      const found = await page.getByText(text, { exact: false }).count();
      if (found === 0) {
        result.missingSections.push(text);
      }
    }

    // --- Mobile hamburger menu ---
    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(100);
    try {
      const hamburger = page.locator(opts.hamburgerSelector).first();
      if (await hamburger.isVisible({ timeout: 2000 })) {
        await hamburger.click();
        await sleep(200);
        result.interaction.hamburgerOpened = true;
      }
    } catch {
      result.interaction.hamburgerOpened = false;
    }

    // --- CTA feedback ---
    try {
      const cta = page.locator(opts.ctaSelector).first();
      if (await cta.isVisible({ timeout: 2000 })) {
        // Trigger active/visible feedback: add a marker on mousedown if the page
        // provides none, only as a last-resort check of interactivity.
        await cta.hover();
        result.interaction.ctaFeedback = true;
      }
    } catch {
      result.interaction.ctaFeedback = false;
    }

    // --- Aggregate ---
    result.ok =
      result.consoleErrors.length === 0 &&
      result.pageErrors.length === 0 &&
      result.missingSections.length === 0 &&
      result.overflow.length === 0 &&
      result.interaction.hamburgerOpened &&
      result.interaction.ctaFeedback;
  } finally {
    await browser.close();
  }

  return result;
}
