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
