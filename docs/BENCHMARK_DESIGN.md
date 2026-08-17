# Benchmark Design

This document defines how LPBench benchmark tasks should be designed and versioned.

## Goals

LPBench should make model runs comparable across time while remaining practical to execute locally and in GitHub Actions.

A benchmark should test a concrete web-generation task with enough constraints to expose differences in:

- visual execution
- instruction following
- responsive behavior
- accessibility
- functionality
- implementation quality
- efficiency

## Versioning

Each benchmark lives under a versioned path:

```text
benchmarks/<name>/<version>/
```

For example:

```text
benchmarks/lp/v1/
├── prompt.md
├── benchmark.json
└── rubric.json
```

A benchmark version must be considered immutable once published with results.

Create a new benchmark version when changing anything that can materially affect model output or score, including:

- prompt wording or required content
- allowed frameworks/libraries
- viewport definitions
- required files
- scoring categories or weights
- machine-checkable requirements

Cosmetic documentation fixes that do not change execution semantics do not require a new benchmark version.

## Prompt rules

A benchmark prompt should:

- be self-contained
- specify the desired artifact rather than implementation hints tailored to one provider
- define hard constraints explicitly
- avoid model-specific instructions
- avoid hidden requirements that only the evaluator knows
- request a directly runnable artifact

For LP v1, the generated artifact is expected to be:

```text
index.html
style.css
script.js
```

## Evaluation categories

The current intended quality categories are:

- Visual Quality
- Responsive
- Functionality
- Accessibility
- Instruction Compliance
- Code Quality
- Technical Quality

The versioned `rubric.json` is the source of truth for category weights.

### Machine-evaluated vs judged metrics

Prefer deterministic checks where possible.

Examples of deterministic checks:

- required file presence
- runtime/console errors
- horizontal overflow
- semantic landmarks
- heading presence
- interaction behavior
- Lighthouse metrics
- forbidden external assets or libraries

Visual polish is inherently subjective and may later use a visual LLM judge. A subjective judge must not silently replace deterministic checks.

If a category cannot be evaluated in the current LPBench version, it should be recorded as `notEvaluated` rather than assigned an invented score.

## Reproducibility metadata

Every run should record enough information to interpret the result later:

- benchmark ID and version
- model/provider identifier
- generation surface (`api`, `cli`, `web`, `manual`)
- timestamp
- generation settings when controllable
- runner version or LPBench commit SHA when available
- browser/Playwright/Lighthouse versions for automated evaluation
- judge model and judge prompt version if a visual judge is used

## Nondeterminism

LLM output is nondeterministic. A single run is useful for development but is not statistically strong evidence of model superiority.

Longer-term leaderboard design should support multiple runs per model/benchmark and report:

- run count
- mean
- median
- minimum/maximum
- standard deviation or another dispersion measure

The initial vertical slice may use one run to validate the pipeline.

## Fairness across surfaces

Do not assume these are equivalent:

- raw provider API
- coding agent using the same or related model
- web application session
- subscription CLI

Coding agents may have system prompts, file tools, iteration loops, or other scaffolding unavailable to raw API calls. LPBench should record `surface` and allow comparisons to be grouped accordingly.

## Efficiency is not quality

Latency, tokens, and cost are valuable benchmark dimensions, but they must not change the quality score.

For example, a cheaper model does not receive quality bonus points. Instead, LPBench derives independent metrics such as:

- quality per dollar
- quality per 1K output tokens
- quality per second

This preserves the distinction between "best output" and "best trade-off."
