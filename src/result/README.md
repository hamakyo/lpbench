# Result

Assembles a normalized LPBench result (`result.json`) from generation data,
deterministic scores, and derived metrics.

## Modules

- `resultBuilder.ts` — `buildResult(input)` combines run identity, generation
  measurements (duration, token usage, cost), and category scores into the
  machine-readable contract in `schemas/result.schema.json`.

## Rules (docs/RESULTS_AND_METRICS.md)

- Total score = sum of *provided* category scores. A partial rubric yields a
  partial/unfinalized result, never a renormalized 100.
- Derived efficiency metrics are computed only when their inputs are known and
  non-zero; otherwise they are omitted, never invented.
- Subscription runs never report a fabricated `actualUsd` (e.g. `$0`).
