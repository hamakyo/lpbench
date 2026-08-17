# Runners

Adapters that turn a benchmark prompt into a normalized `GenerationResult`.

Planned adapters:

- `api/` — provider APIs such as OpenAI, Anthropic, and Google
- `cli/` — subscription-backed coding agents such as Codex CLI and Claude Code
- `manual/` — imported results from web apps or other external generation surfaces

Runner implementations must not perform scoring. Evaluation is handled separately under `src/evaluators/`.
