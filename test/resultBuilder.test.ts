import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { buildResult, type ResultInput } from "../src/result/resultBuilder.ts";

const require = createRequire(import.meta.url);
const Ajv2020: any = require("ajv/dist/2020");

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const resultSchema = JSON.parse(
  readFileSync(join(repoRoot, "schemas/result.schema.json"), "utf8")
);
const validate = new Ajv2020({ strict: true, allErrors: true }).compile(resultSchema);

function fullInput(): ResultInput {
  return {
    runId: "run-123",
    benchmark: { id: "lp-v1", version: "1.0.0" },
    model: { provider: "openai", id: "gpt-4o", surface: "api" as const },
    generationDurationMs: 30_000,
    ttftMs: 500,
    usage: { inputTokens: 2000, outputTokens: 4000, totalTokens: 6000 },
    scores: {
      visual: 20,
      responsive: 15,
      functionality: 15,
      accessibility: 8,
      compliance: 15,
      codeQuality: 9,
      technical: 8,
    },
    actualApiCostUsd: 0.5,
    billing: "api" as const,
    pricingDate: "2026-08-19",
    artifactFiles: {
      "index.html": "<html>\n<body>\n</html>",
      "style.css": "body{}",
    },
  };
}

test("buildResult produces a schema-valid result.json", () => {
  const r = buildResult(fullInput());
  assert.equal(validate(r), true, JSON.stringify(validate.errors, null, 2));
});

test("buildResult computes total as sum of provided category scores", () => {
  const r = buildResult(fullInput());
  const s = r.scores as any;
  assert.equal(s.total, 20 + 15 + 15 + 8 + 15 + 9 + 8);
});

test("buildResult derives efficiency metrics when inputs known", () => {
  const r = buildResult(fullInput());
  const eff = r.efficiency as any;
  // total = 90, outputTokens = 4000 -> 90/4000*1000 = 22.5
  assert.equal(eff.scorePer1kOutputTokens, 22.5);
  // total 90 / $0.5 = 180
  assert.equal(eff.scorePerDollar, 180);
  // total 90 / 30s = 3
  assert.equal(eff.scorePerSecond, 3);
  // 4000 tokens / 30s = 133.33...
  assert.ok(Math.abs(eff.outputTokensPerSecond - (4000 / 30)) < 1e-9);
});

test("buildResult records artifact lines and bytes", () => {
  const r = buildResult(fullInput());
  const a = r.artifact as any;
  // 3 (index.html) + 1 (style.css) lines, bytes > 0
  assert.equal(a.lines, 4);
  assert.ok(a.bytes > 0);
});

test("efficiency is omitted when inputs are unknown (no fabrication)", () => {
  const input = fullInput();
  delete input.usage;
  delete input.actualApiCostUsd;
  input.generationDurationMs = 0;
  const r = buildResult(input);
  assert.equal(r.efficiency, undefined);
});

test("cost/actualUsd is omitted for subscription (never zero)", () => {
  const input = fullInput();
  input.billing = "subscription";
  delete input.actualApiCostUsd;
  const r = buildResult(input);
  const cost = r.cost as any;
  assert.equal(cost.billing, "subscription");
  assert.equal(cost.actualUsd, undefined);
});

test("partial scores still validate and total reflects provided only", () => {
  const input = fullInput();
  input.scores = { visual: 20, responsive: 15 };
  const r = buildResult(input);
  assert.equal((r.scores as any).total, 35);
  assert.equal(validate(r), true, JSON.stringify(validate.errors));
});

test("result remains schema-valid even with all optional fields absent", () => {
  const r = buildResult({
    runId: "run-min",
    benchmark: { id: "lp-v1", version: "1.0.0" },
    model: { provider: "x", id: "y", surface: "manual" },
    generationDurationMs: 1000,
    scores: {},
  });
  assert.equal(validate(r), true, JSON.stringify(validate.errors, null, 2));
});

// --- lighthouse block ---

test("buildResult emits a schema-valid lighthouse block for an ok run", () => {
  const input = fullInput();
  input.lighthouse = {
    status: "ok",
    metrics: { performance: 0.95, accessibility: 0.9, bestPractices: 1, seo: 0.85, lcpMs: 2400 },
  };
  const r = buildResult(input);
  const lh = r.lighthouse as any;
  assert.equal(lh.evaluator, "lighthouse");
  assert.equal(lh.status, "ok");
  assert.equal(lh.metrics.performance, 0.95);
  assert.equal(lh.metrics.lcpMs, 2400);
  assert.equal(lh.warning, undefined);
  assert.equal(validate(r), true, JSON.stringify(validate.errors, null, 2));
});

test("buildResult omits undefined metrics fields and warning when absent", () => {
  const input = fullInput();
  input.lighthouse = {
    status: "ok",
    metrics: { performance: 0.95, accessibility: 0.9, bestPractices: 1, seo: 0.85, cls: undefined },
  };
  const r = buildResult(input);
  const lh = r.lighthouse as any;
  assert.deepEqual(Object.keys(lh.metrics).sort(), ["accessibility", "bestPractices", "performance", "seo"]);
  assert.equal(lh.warning, undefined);
});

test("buildResult supports a skipped lighthouse outcome without metrics", () => {
  const input = fullInput();
  input.lighthouse = { status: "skipped", warning: "no Chrome available" };
  const r = buildResult(input);
  const lh = r.lighthouse as any;
  assert.equal(lh.status, "skipped");
  assert.equal(lh.warning, "no Chrome available");
  assert.equal(lh.metrics, undefined);
  assert.equal(validate(r), true, JSON.stringify(validate.errors, null, 2));
});

test("result schema rejects an ok lighthouse block without metrics", () => {
  const input = fullInput();
  input.lighthouse = { status: "ok" };
  const r = buildResult(input);
  assert.equal(validate(r), false, "ok status requires metrics");
});

test("result schema emits scorePer1kTotalTokens in efficiency", () => {
  const r = buildResult(fullInput()); // totalTokens = 6000, total = 90
  const eff = r.efficiency as any;
  assert.equal(eff.scorePer1kTotalTokens, 15);
  assert.equal(validate(r), true, JSON.stringify(validate.errors, null, 2));
});
