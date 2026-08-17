# Roadmap

LPBench should grow through small end-to-end milestones rather than implementing every provider, evaluator, and dashboard feature at once.

## v0.1 — First vertical slice

Goal: prove one complete benchmark run from generation to normalized result.

Scope:

- LP benchmark v1
- OpenAI API runner
- generated `index.html`, `style.css`, `script.js`
- local preview server
- Playwright checks
- desktop/tablet/mobile screenshots
- Lighthouse metrics
- generation wall time
- provider-reported token usage
- pricing registry and API cost calculation
- basic efficiency metrics
- schema-validated `result.json`
- fixture-based tests that do not call paid APIs
- manual `workflow_dispatch` GitHub Action
- run exported as GitHub Actions artifact

Non-goals:

- GitHub Pages dashboard
- visual LLM judge
- Anthropic/Gemini providers
- Codex/Claude Code runners
- automatic commits of benchmark outputs
- multi-run statistics

## v0.2 — Multiple generation surfaces

Goal: prove that evaluation is independent from generation.

Scope candidates:

- Codex CLI runner using subscription authentication locally
- manual import runner
- Anthropic API runner
- Gemini API runner
- explicit `surface` grouping (`api`, `cli`, `web`, `manual`)
- API-equivalent estimates only where defensible and clearly labeled
- improved provider-raw usage preservation

## v0.3 — Public results site

Goal: make benchmark results easy to inspect and compare.

Scope candidates:

- GitHub Pages dashboard
- quality leaderboard
- speed/cost/token-efficiency views
- model/run detail page
- screenshot gallery
- sandboxed live artifact preview
- quality-vs-cost scatter plot
- quality-vs-latency scatter plot
- filtering by benchmark version and generation surface

## v0.4 — Visual evaluation and repeated runs

Goal: improve statistical usefulness and visual-quality coverage.

Scope candidates:

- versioned visual-judge prompt
- one or more visual judge models
- deterministic score kept separate from judged score
- multiple runs per model
- mean/median/min/max
- standard deviation or comparable dispersion metric
- run-level provenance

## v0.5 — Benchmark suite

Goal: expand beyond a single landing-page task.

Possible benchmarks:

- SaaS dashboard
- authentication page
- pricing page
- todo application
- settings UI
- data table/admin UI

Each benchmark remains independently versioned.

## Future considerations

Potential later work:

- self-hosted runners for authenticated coding-agent subscriptions
- local LLM adapters
- evaluator versioning and re-evaluation workflows
- historical trend charts across model versions
- exportable benchmark datasets
- CI checks for benchmark-definition changes
- public contribution process for new benchmark tasks

## Development rule

Prefer a narrow feature that works end-to-end over a broad set of partially connected abstractions.

For every milestone, preserve this pipeline:

```text
Runner
  -> normalized generation result
  -> immutable artifact
  -> provider-independent evaluator
  -> normalized benchmark result
  -> presentation/export
```
