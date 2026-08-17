# LPBench

Continuous benchmark for LLM-generated landing pages and web interfaces.

## Goals

LPBench separates **generation**, **evaluation**, **storage**, and **visualization** so outputs from APIs, coding agents, and manual runs can be compared under the same benchmark conditions.

## Planned flow

```text
Benchmark Definition
        |
        v
Runner (API / CLI / Manual)
        |
        v
Generated Artifact
        |
        v
Evaluator
        |
        v
result.json
        |
        +--> Git history
        +--> GitHub Pages dashboard
```

## Repository layout

```text
benchmarks/   Versioned benchmark prompts and rubrics
src/runners/  Generation adapters (API / CLI / manual)
src/evaluators/ Common evaluation modules
src/metrics/  Cost, latency, token and efficiency metrics
schemas/      Result and benchmark schemas
runs/         Generated benchmark runs
site/         GitHub Pages dashboard
.github/      GitHub Actions workflows
```

## v0 target

- LP benchmark v1
- OpenAI API runner
- Codex CLI runner
- Manual import
- Playwright checks and screenshots
- Lighthouse evaluation
- Quality / time / token / cost metrics
- GitHub Pages dashboard

> The scaffold intentionally contains minimal implementation. The first milestone is a single end-to-end vertical slice: generate one LP, evaluate it, emit `result.json`, and publish the result.
