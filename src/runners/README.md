# Runners

Adapters that turn a benchmark prompt into a normalized `GenerationResult`.

Implemented adapters:

- `openaiRunner.ts` — OpenAI Chat Completions API runner. The model returns
  the required artifact files as a JSON object; the runner writes them to the
  output directory and normalizes usage/timing. Key comes from
  `options.apiKey` or `OPENAI_API_KEY` (never serialized into results —
  `docs/SECURITY.md`).

Planned adapters:

- `cli/` — subscription-backed coding agents such as Codex CLI and Claude Code
- `manual/` — imported results from web apps or other external generation surfaces

Runner implementations must not perform scoring or pricing. Evaluation is
handled separately under `src/evaluators/`, cost under `src/metrics/cost.ts`
(`docs/ARCHITECTURE.md` "Runner").

### Preview server

`previewServer.ts` serves a generated artifact over an isolated loopback HTTP origin so
evaluators (and Playwright) can inspect it with HTTP semantics. See the security contract
in `docs/SECURITY.md` — it serves only the artifact directory and rejects path traversal.
