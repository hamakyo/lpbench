# Pricing registry

Provider pricing snapshots live here as `<provider>.json` files
(e.g. `openai.json`). Pricing is time-dependent data, so it is never
hard-coded into runners (`docs/ARCHITECTURE.md` "Pricing registry").

Each benchmark run should record the pricing information it used so historical
results remain reproducible after provider price changes
(`docs/RESULTS_AND_METRICS.md` "Cost").

## Snapshot format

```json
{
  "snapshotDate": "YYYY-MM-DD",
  "provider": "openai",
  "currency": "USD",
  "source": "where the prices were read from",
  "prices": {
    "gpt-4o": { "inputPerMillion": 2.5, "outputPerMillion": 10.0, "cachedInputPerMillion": 1.25 }
  }
}
```

- Prices are USD per 1,000,000 tokens.
- `cachedInputPerMillion` is optional; when omitted, cached tokens fall back to
  the input rate.
- Cost is only computed when the provider *and* model are present in the
  registry. Missing pricing never aborts a run — cost stays unknown.
- Extend a snapshot by adding a model entry; update `snapshotDate` when the
  recorded prices change. Do not silently edit old snapshots that runs already
  reference — snapshot a new date instead.

## Consumers

- `src/pricing/registry.ts` — load snapshots and look up model prices
- `src/metrics/cost.ts` — `apiCostUsd(provider, model, usage)` / `calculateApiCostUsd`