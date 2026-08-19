import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scorePer1kOutputTokens,
  scorePer1kTotalTokens,
  scorePerDollar,
  scorePerSecond,
  outputTokensPerSecond,
} from "../src/metrics/efficiency.ts";

test("scorePer1kOutputTokens computes score / outputTokens * 1000", () => {
  // quality 85 / 2000 tokens * 1000 = 42.5
  assert.equal(scorePer1kOutputTokens(85, 2000), 42.5);
});

test("scorePer1kOutputTokens returns undefined when outputTokens missing/zero", () => {
  assert.equal(scorePer1kOutputTokens(85, undefined), undefined);
  assert.equal(scorePer1kOutputTokens(85, null), undefined);
  assert.equal(scorePer1kOutputTokens(85, 0), undefined);
});

test("scorePer1kTotalTokens computes correctly", () => {
  assert.equal(scorePer1kTotalTokens(50, 10000), 5);
});

test("scorePerDollar divides by actual API cost only", () => {
  assert.equal(scorePerDollar(80, 0.4), 200);
  // unknown cost -> undefined, never fabricated
  assert.equal(scorePerDollar(80, undefined), undefined);
  assert.equal(scorePerDollar(80, 0), undefined);
});

test("scorePerSecond divides by generation seconds", () => {
  assert.equal(scorePerSecond(60, 30), 2);
  assert.equal(scorePerSecond(60, undefined), undefined);
});

test("outputTokensPerSecond is a throughput metric", () => {
  assert.equal(outputTokensPerSecond(3000, 60), 50);
  assert.equal(outputTokensPerSecond(3000, 0), undefined);
  assert.equal(outputTokensPerSecond(undefined, 60), undefined);
});

test("non-finite / negative inputs are rejected, not fabricated", () => {
  assert.equal(scorePer1kOutputTokens(85, -1), undefined);
  assert.equal(scorePerDollar(80, -0.1), undefined);
  assert.equal(outputTokensPerSecond(NaN, 60), undefined);
  assert.equal(outputTokensPerSecond(3000, Infinity), undefined);
});
