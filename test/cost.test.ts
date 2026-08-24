import { test } from "node:test";
import assert from "node:assert/strict";
import { apiCostUsd, calculateApiCostUsd, type PriceEntry } from "../src/metrics/cost.ts";
import type { TokenUsage } from "../src/types.ts";

const GPT4O: PriceEntry = {
  inputPerMillion: 2.5,
  outputPerMillion: 10.0,
  cachedInputPerMillion: 1.25,
};

const O3: PriceEntry = { inputPerMillion: 2.0, outputPerMillion: 8.0 };

test("cost: cached tokens billed at the cached rate", () => {
  const usage: TokenUsage = { inputTokens: 3_000_000, cachedTokens: 1_000_000, outputTokens: 1_000_000 };
  // 2M fresh input * $2.5/1M + 1M cached * $1.25/1M + 1M output * $10/1M = 5 + 1.25 + 10
  assert.equal(calculateApiCostUsd(GPT4O, usage), 16.25);
});

test("cost: output-only usage", () => {
  const usage: TokenUsage = { outputTokens: 1_000 };
  assert.equal(calculateApiCostUsd(GPT4O, usage), 0.01);
});

test("cost: cached falls back to the input rate when no cached rate published", () => {
  const usage: TokenUsage = { inputTokens: 2_000_000, cachedTokens: 1_000_000 };
  // No cached tier for o3: both halves at $2/1M.
  assert.equal(calculateApiCostUsd(O3, usage), 4.0);
});

test("cost: zero-token usage costs $0 (not unknown)", () => {
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  assert.equal(calculateApiCostUsd(GPT4O, usage), 0);
});

test("cost: unknown usage stays undefined (never fabricated)", () => {
  assert.equal(calculateApiCostUsd(GPT4O, {}), undefined);
  assert.equal(calculateApiCostUsd(GPT4O, { inputTokens: -5 }), undefined);
  assert.equal(calculateApiCostUsd(GPT4O, undefined as unknown as TokenUsage), undefined);
});

test("apiCostUsd resolves provider -> model -> price from the registry", () => {
  const usage: TokenUsage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
  assert.equal(apiCostUsd("openai", "gpt-4o", usage), 12.5);
});

test("apiCostUsd is undefined for unknown model / provider / no usage", () => {
  const usage: TokenUsage = { inputTokens: 1_000_000 };
  assert.equal(apiCostUsd("openai", "gpt-99-unknown", usage), undefined);
  assert.equal(apiCostUsd("not-a-provider", "gpt-4o", usage), undefined);
  assert.equal(apiCostUsd("openai", "gpt-4o", undefined), undefined);
});