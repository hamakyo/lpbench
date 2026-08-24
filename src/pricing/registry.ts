/**
 * Pricing registry (docs/ARCHITECTURE.md "Pricing registry").
 *
 * Provider pricing is time-dependent data, so it is NOT hard-coded into
 * runners. Snapshots live under `data/pricing/<provider>.json`; each run
 * records the pricing inputs it used so historical costs stay stable after
 * provider price changes (docs/RESULTS_AND_METRICS.md "Cost").
 *
 * Availability is distinguished from an invented value: if a provider or
 * model is missing from the registry, cost stays unknown (`undefined`) and
 * the benchmark run continues. Never guess pricing.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Per-model price, USD per 1M tokens. */
export interface PriceEntry {
  inputPerMillion: number;
  outputPerMillion: number;
  /** Discounted cached-input rate when the provider publishes one. */
  cachedInputPerMillion?: number;
}

/** A versioned provider pricing snapshot. */
export interface PricingSnapshot {
  /** ISO date (YYYY-MM-DD) the snapshot was recorded. */
  snapshotDate: string;
  provider: string;
  currency: "USD";
  /** Where the snapshot came from (for provenance). */
  source?: string;
  prices: Record<string, PriceEntry>;
}

const REGISTRY_DIR = fileURLToPath(new URL("../../data/pricing/", import.meta.url));

/** Absolute path of the snapshot file for a provider. */
export function pricingRegistryPath(provider: string): string {
  return `${REGISTRY_DIR}${provider}.json`;
}

/**
 * Load a provider pricing snapshot.
 *
 * Returns `undefined` when no snapshot exists for the provider (cost remains
 * unknown). Throws on malformed JSON — a corrupt snapshot is a data bug.
 */
export function loadPricingSnapshot(provider: string): PricingSnapshot | undefined {
  let raw: string;
  try {
    raw = readFileSync(pricingRegistryPath(provider), "utf8");
  } catch {
    return undefined;
  }
  return JSON.parse(raw) as PricingSnapshot;
}

/** Look up the per-model price entry in a snapshot, if published. */
export function lookupPrice(snapshot: PricingSnapshot, modelId: string): PriceEntry | undefined {
  return snapshot.prices[modelId];
}