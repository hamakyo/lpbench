import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractLighthouseMetrics,
  runLighthouseChecks,
  type LighthouseOutcome,
} from "../src/evaluators/lighthouseChecks.ts";

const FIXTURE_REPORT = {
  categories: {
    performance: { score: 0.95 },
    accessibility: { score: 0.9 },
    "best-practices": { score: 1 },
    seo: { score: 0.85 },
  },
  audits: {
    "largest-contentful-paint": { numericValue: 2400 },
    "cumulative-layout-shift": { numericValue: 0.02 },
    "total-blocking-time": { numericValue: 150 },
    "speed-index": { numericValue: 3200 },
    interactive: { numericValue: 4100 },
  },
};

test("extractLighthouseMetrics maps categories and audits", () => {
  const m = extractLighthouseMetrics(FIXTURE_REPORT);
  assert.equal(m.performance, 0.95);
  assert.equal(m.accessibility, 0.9);
  assert.equal(m.bestPractices, 1);
  assert.equal(m.seo, 0.85);
  assert.equal(m.lcpMs, 2400);
  assert.equal(m.cls, 0.02);
  assert.equal(m.tbtMs, 150);
  assert.equal(m.speedIndexMs, 3200);
  assert.equal(m.interactiveMs, 4100);
});

test("extractLighthouseMetrics keeps a zero CLS (valid measurement)", () => {
  const report = JSON.parse(JSON.stringify(FIXTURE_REPORT));
  report.audits["cumulative-layout-shift"].numericValue = 0;
  const m = extractLighthouseMetrics(report);
  assert.equal(m.cls, 0);
});

test("extractLighthouseMetrics omits missing audits (never invents measurements)", () => {
  const report = JSON.parse(JSON.stringify(FIXTURE_REPORT));
  delete report.audits["speed-index"];
  const m = extractLighthouseMetrics(report);
  assert.equal(m.speedIndexMs, undefined);
  assert.equal(m.lcpMs, 2400);
});

test("extractLighthouseMetrics throws when a core category is missing", () => {
  const report = JSON.parse(JSON.stringify(FIXTURE_REPORT));
  delete report.categories.seo;
  assert.throws(() => extractLighthouseMetrics(report), /missing category "seo"/);
  assert.throws(() => extractLighthouseMetrics(null), /not an object/);
});

test("runLighthouseChecks degrades gracefully when Chrome is unavailable", async () => {
  // Deterministic offline case: a nonexistent Chrome binary must fail/skip
  // with a warning and no fabricated metrics.
  const outcome: LighthouseOutcome = await runLighthouseChecks("http://127.0.0.1:1/", {
    chromePath: "/nonexistent/chrome-binary",
    timeoutMs: 5000,
  });
  assert.ok(outcome.status === "skipped" || outcome.status === "failed");
  assert.ok(typeof outcome.warning === "string" && outcome.warning.length > 0);
  assert.equal(outcome.metrics, undefined);
});