# Evaluators

Common evaluation modules applied after generation, regardless of runner.

Planned modules:

- structure / DOM checks
- Playwright functionality checks
- responsive checks at benchmark-defined viewports
- Lighthouse accessibility / quality checks
- instruction compliance checks
- code quality checks
- screenshot generation
- optional visual LLM judge

Evaluators should operate on generated artifacts and emit machine-readable score fragments that can be combined into `result.json`.

### Static checks

`staticChecks.ts` provides browser-free deterministic checks covering the
machine-checkable parts of instruction compliance and code quality:

- required file presence
- forbidden external assets / libraries / fonts (HTML + CSS scan)
- required content/copy presence
- basic document structure (html/head/body/viewport)

Checks emit `passed | failed | unknown | notEvaluated` statuses and never
fabricate a numeric score for something not measured (docs/ARCHITECTURE.md).
Browser-dependent checks (runtime errors, horizontal overflow, interaction)
belong to the Playwright evaluator.

### Browser checks (Playwright)

`browserChecks.ts` runs a generated artifact in real Chromium over the preview
server origin (`src/runners/previewServer.ts`) and covers the deterministic
browser-checkable parts of the benchmark:

- page loads without console / uncaught page errors
- no horizontal overflow at benchmark viewports
- required sections / copy are present
- mobile hamburger menu and CTA are interactive
- per-viewport screenshots

The page is treated as untrusted (`docs/SECURITY.md`): a fresh browser context
per run and external network requests are blocked. Requires Chromium
(`pnpm exec playwright install chromium`).
