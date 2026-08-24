/**
 * API cost calculation (docs/RESULTS_AND_METRICS.md "Cost").
 *
 * Cost for API runs is derived from provider-reported token usage and the
 * pricing snapshot active for the run date. The result stays `undefined`
 * (unknown) whenever the provider or model has no entry in the registry —
 * pricing is never guessed, and a missing price must not abort a run.
 *
 * Cached tokens are billed at the cached-input rate when the snapshot
 * publishes one, otherwise at the input rate.
 */

import {
  loadPricingSnapshot,
  lookupPrice,
  type PriceEntry,
} from "../pricing/registry.ts";
import type { TokenUsage } from "../types.ts";

export type { PriceEntry } from "../pricing/registry.ts";

function finiteNumber(v: number | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/**
 * USD cost of a provider-reported usage under one price entry.
 *
 * 0-token usage is valid (it genuinely costs $0); only missing/non-finite
 * values are treated as unknown.
 */
export function calculateApiCostUsd(price: PriceEntry, usage: TokenUsage): number | undefined {
  if (usage === undefined || usage === null) return undefined;
  const input = finiteNumber(usage.inputTokens);
  const output = finiteNumber(usage.outputTokens);
  if (input === undefined && output === undefined) return undefined;

  const cached = finiteNumber(usage.cachedTokens) ?? 0;
  // Input tokens reported as cached are billed at the cached rate instead of
  // the full input rate. Never bill more input than was reported.
  const billedInput = Math.max(0, (input ?? 0) - cached);
  const cachedRate = price.cachedInputPerMillion ?? price.inputPerMillion;

  return (
    (billedInput / 1_000_000) * price.inputPerMillion +
    (cached / 1_000_000) * cachedRate +
    ((output ?? 0) / 1_000_000) * price.outputPerMillion
  );
}

/**
 * USD cost for a model run, or `undefined` when pricing is unavailable.
 *
 * Convenience wrapper used at result assembly: provider -> snapshot ->
 * model price -> usage-based cost.
 */
export function apiCostUsd(
  provider: string,
  modelId: string,
  usage: TokenUsage | undefined
): number | undefined {
  if (!usage) return undefined;
  const snapshot = loadPricingSnapshot(provider);
  if (!snapshot) return undefined;
  const price = lookupPrice(snapshot, modelId);
  if (!price) return undefined;
  return calculateApiCostUsd(price, usage);
}