<div align="center">
  <h1>LPBench</h1>
  <p><strong>Continuous benchmark for LLM-generated landing pages and web interfaces.</strong></p>
  <p>
    <img alt="Status: Experimental" src="https://img.shields.io/badge/status-experimental-orange">
    <img alt="Benchmark: LP v1" src="https://img.shields.io/badge/benchmark-LP%20v1-6f42c1">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/hamakyo/lpbench?style=flat">
    <img alt="Last commit" src="https://img.shields.io/github/last-commit/hamakyo/lpbench">
  </p>
  <p>English | <a href="./README.ja.md">日本語</a></p>
</div>

## Goals

LPBench separates **generation**, **evaluation**, **storage**, and **visualization** so outputs from APIs, coding agents, and manual runs can be compared under the same benchmark conditions.

## Documentation

Design and implementation guidance lives in [`docs/`](./docs/README.md):

- [Architecture](./docs/ARCHITECTURE.md)
- [Benchmark Design](./docs/BENCHMARK_DESIGN.md)
- [Results and Metrics](./docs/RESULTS_AND_METRICS.md)
- [Security Model](./docs/SECURITY.md)
- [Roadmap](./docs/ROADMAP.md)

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

## Development

This project is **pnpm-managed** — use pnpm, not npm/yarn. Corepack will pick up the pinned version from the `packageManager` field.

```sh
corepack enable                 # one-time: activate corepack/pnpm shims
pnpm install                    # install deps (creates pnpm-lock.yaml)
pnpm run check                  # type-check (tsc --noEmit)
pnpm test                       # run unit tests (node:test, no paid APIs)
```

> The `package-lock.json` / `yarn.lock` lockfiles are intentionally blocked in `.gitignore`. Only `pnpm-lock.yaml` is tracked.

## Repository layout

```text
benchmarks/   Versioned benchmark prompts and rubrics
docs/         Architecture, benchmark rules, metrics, security, and roadmap
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
