# LPBench Documentation

This directory contains the design contract for LPBench. Implementation should follow these documents unless a later decision explicitly changes them.

## Documents

- [Architecture](./ARCHITECTURE.md) — system boundaries and data flow
- [Benchmark Design](./BENCHMARK_DESIGN.md) — fairness, reproducibility, and benchmark versioning
- [Results and Metrics](./RESULTS_AND_METRICS.md) — result format, scoring, tokens, latency, and cost
- [Security Model](./SECURITY.md) — handling untrusted generated web content
- [Roadmap](./ROADMAP.md) — staged implementation plan

## Core principles

1. **Generation and evaluation are independent.** API, coding-agent, local, and manual outputs should enter the same evaluation pipeline.
2. **Benchmark definitions are versioned.** Prompt, rubric, required files, and viewport configuration belong to the benchmark definition, not provider-specific code.
3. **Quality and efficiency are separate axes.** Cost, latency, and token usage must not increase or decrease the quality score.
4. **Do not invent unavailable measurements.** Unknown token usage, TTFT, cost, or provider metadata should remain unknown/null.
5. **Generated code is untrusted input.** Evaluators must not expose secrets or host privileges to generated HTML/JavaScript.
6. **Raw artifacts are retained.** A generated run should be re-evaluable later without calling the model again.

## Initial milestone

The first vertical slice is intentionally small:

```text
LP v1 prompt
  -> OpenAI API runner
  -> generated HTML/CSS/JS
  -> local preview server
  -> Playwright checks + screenshots
  -> Lighthouse metrics
  -> result.json
  -> GitHub Actions artifact
```

GitHub Pages visualization, visual LLM judging, multiple providers, and multi-run statistics are later milestones.
