# Results and Metrics

LPBench stores one normalized result per benchmark run. The machine-readable contract is `schemas/result.schema.json`; this document explains the intended semantics.

## Result layers

A finalized run combines four distinct kinds of data:

1. **Identity** — benchmark, model, provider, surface, run ID, timestamp
2. **Generation measurements** — duration and provider-reported token usage
3. **Evaluation measurements** — deterministic checks, Lighthouse, and future judged metrics
4. **Derived metrics** — quality score, cost, and efficiency ratios

These layers should remain distinguishable in code and serialized output.

## Token usage

Normalize provider usage where available into:

```text
inputTokens
outputTokens
totalTokens
cachedTokens      optional
reasoningTokens   optional
```

Rules:

- Prefer provider-reported values.
- Do not estimate unavailable token counts unless an explicit, documented estimator is introduced later.
- Preserve provider-specific raw usage separately when useful.
- Token definitions may differ between providers, so cross-provider token comparisons should be treated as approximate rather than perfectly standardized.

## Timing

The primary latency metric is **generation wall time**:

```text
request start
  -> model/provider processing
  -> complete generated response available
```

Store it as `durationMs`.

When reliably available, additional measurements may include:

- time to first token (`ttftMs`)
- output tokens per second

Do not mix evaluator runtime, screenshot time, Lighthouse time, or GitHub Actions queue time into generation latency.

## Cost

### API runs

API cost is calculated from provider-reported token usage and the pricing registry active for the run date.

The run should snapshot the pricing inputs used so that historical costs do not change when current provider pricing changes.

### Subscription runs

A subscription run does not have a meaningful per-call marginal API charge. Therefore:

```text
actual run cost = unknown / not applicable
```

Do not report `$0` simply because the subscription has already been paid.

If LPBench later computes an API-equivalent estimate, it must be labeled separately as `estimatedApiEquivalentUsd` and must never be presented as actual spend.

### Missing pricing

If model pricing is unavailable in the registry, cost should remain null/unknown and the benchmark run should continue.

Never guess pricing.

## Quality score

Quality score represents the generated artifact itself. The versioned benchmark rubric controls category weights.

Current intended categories:

```text
Visual Quality
Responsive
Functionality
Accessibility
Instruction Compliance
Code Quality
Technical Quality
```

Evaluation state should distinguish at least:

```text
passed
failed
unknown
notEvaluated
```

A category that is not evaluated must not be silently treated as zero or as a perfect score.

If the evaluated categories do not cover the full rubric, report a partial/unfinalized quality result rather than renormalizing it to create a misleading 100-point score.

## Efficiency metrics

Efficiency metrics are derived only when their inputs are known and non-zero.

### Quality per 1K output tokens

```text
qualityScore / outputTokens * 1000
```

Shows how much evaluated quality is produced relative to generated token volume.

### Quality per 1K total tokens

```text
qualityScore / totalTokens * 1000
```

Useful when input/context size differs meaningfully between benchmark configurations.

### Quality per dollar

```text
qualityScore / actualApiCostUsd
```

Only valid when actual API cost is known. Do not use subscription cost as zero.

### Quality per second

```text
qualityScore / generationSeconds
```

Captures quality/latency trade-off.

### Output tokens per second

```text
outputTokens / generationSeconds
```

A throughput metric, not a quality metric.

## Artifact metrics

Record simple implementation-size metrics such as:

- generated lines of code
- total artifact bytes
- optionally per-file bytes/LOC

These values should remain descriptive. A shorter implementation is not automatically better.

## Recommended run structure

```text
runs/<benchmark-id>/<run-id>/
├── artifact/
├── screenshots/
├── raw/
└── result.json
```

The exact generated files and raw generation metadata should be retained so evaluator logic can evolve independently of generation.

## Dashboard interpretation

LPBench should avoid a single opaque composite ranking for all objectives. The site should eventually allow separate views for:

- Quality
- Speed
- Cost
- Token Efficiency
- Quality / Cost
- Quality / Latency

This lets users choose the trade-off relevant to their workload instead of hiding it inside one score.
