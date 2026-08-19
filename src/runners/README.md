# Runners

Adapters that turn a benchmark prompt into a normalized `GenerationResult`.

Planned adapters:

- `api/` — provider APIs such as OpenAI, Anthropic, and Google
- `cli/` — subscription-backed coding agents such as Codex CLI and Claude Code
- `manual/` — imported results from web apps or other external generation surfaces

Runner implementations must not perform scoring. Evaluation is handled separately under `src/evaluators/`.

### Preview server

`previewServer.ts` serves a generated artifact over an isolated loopback HTTP origin so
evaluators (and Playwright) can inspect it with HTTP semantics. See the security contract
in `docs/SECURITY.md` — it serves only the artifact directory and rejects path traversal.
