# Architecture

LPBench is a continuous benchmark for LLM-generated landing pages and web interfaces. The architecture deliberately separates **generation**, **evaluation**, **storage**, and **visualization**.

## Data flow

```text
Benchmark Definition
        |
        v
Runner
(API / CLI / Manual)
        |
        v
GenerationResult
        |
        v
Artifact Store
(HTML / CSS / JS / raw response)
        |
        v
Evaluator
(Playwright / Lighthouse / static checks)
        |
        v
BenchmarkResult
(result.json + screenshots)
        |
        +--> Git history / Actions artifacts
        |
        +--> GitHub Pages dashboard
```

## Responsibilities

### Benchmark definition

Location: `benchmarks/<benchmark>/<version>/`

Owns:

- prompt
- benchmark ID and version
- required files
- viewport definitions
- rubric and score weights
- benchmark-specific constraints

Provider-specific behavior must not be encoded here.

### Runner

Location: `src/runners/`

A Runner is responsible only for obtaining a generated artifact from a generation surface.

Examples:

- OpenAI API
- Anthropic API
- Gemini API
- Codex CLI
- Claude Code
- manual import
- local model

All runners should normalize their output into a common `GenerationResult` shape. Provider-specific usage may be retained as raw metadata, but evaluators must not depend on it.

### Artifact handling

A run should persist the exact files evaluated. The intended layout is:

```text
runs/<benchmark-id>/<run-id>/
├── artifact/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── screenshots/
│   ├── desktop.webp
│   ├── tablet.webp
│   └── mobile.webp
├── raw/
│   └── generation.json
└── result.json
```

Artifacts should be immutable after a run is finalized. Re-evaluation should produce a new evaluation record or explicitly record the evaluator version.

### Evaluator

Location: `src/evaluators/`

Evaluators operate on generated artifacts, not providers. Expected modules include:

- structure/DOM checks
- interaction checks
- responsive checks
- console/runtime error detection
- screenshot capture
- Lighthouse
- instruction compliance
- future visual judge

The evaluator should distinguish `passed`, `failed`, `unknown`, and `notEvaluated` rather than coercing unavailable checks into a numeric score.

### Metrics

Location: `src/metrics/`

Owns normalized measurements and derived efficiency metrics:

- generation wall time
- token usage
- API cost
- estimated API-equivalent cost for subscription surfaces when explicitly supported
- generated LOC/bytes
- score per token
- score per dollar
- score per second
- output tokens per second

Metrics must not alter the quality score.

### Pricing registry

Location: `data/pricing/`

Pricing is time-dependent data and should not be hard-coded into runners. Each run should snapshot the pricing values used for cost calculation so historical results remain stable after provider price changes.

### Visualization

Location: `site/`

The GitHub Pages application is a consumer of results. It must not contain benchmark evaluation logic.

Initial views should eventually include:

- quality leaderboard
- speed leaderboard
- cost leaderboard
- token-efficiency leaderboard
- quality vs cost scatter plot
- quality vs latency scatter plot
- model/run detail pages
- desktop/tablet/mobile previews

## Execution surfaces

LPBench treats the generation surface as first-class metadata.

```text
api
cli
web
manual
```

A raw API model and a coding agent using a related model are not assumed to be equivalent. Leaderboards should be filterable or grouped by surface so agent tooling does not silently contaminate raw-model comparisons.

## Design rule

The central abstraction is not "call an LLM". It is:

> Accept a web artifact from any generation route and evaluate it under the same benchmark contract.
