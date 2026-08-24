/**
 * Fixture smoke run (CI, docs/ROADMAP.md v0.1).
 *
 * Proves the evaluation pipeline end-to-end WITHOUT any paid API: a known-good
 * artifact is served by the preview server, checked by static + Playwright
 * evaluators, and assembled into a schema-valid `result.json` under
 * `runs/<benchmark-id>/<run-id>/`, which the CI workflow exports as a GitHub
 * Actions artifact.
 *
 * This is an unscored smoke run: `scores` is intentionally left empty (a
 * partial/unfinalized result, per docs/RESULTS_AND_METRICS.md). Numeric rubric
 * scoring is a separate layer and is not fabricated here.
 */

import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { startPreviewServer } from "../src/runners/previewServer.ts";
import { runBrowserChecks } from "../src/evaluators/browserChecks.ts";
import {
  documentStructureCheck,
  externalAssetCheck,
  requiredContentCheck,
  requiredFilesCheck,
} from "../src/evaluators/staticChecks.ts";
import { buildResult } from "../src/result/resultBuilder.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const benchmark = JSON.parse(
  readFileSync(join(repoRoot, "benchmarks/lp/v1/benchmark.json"), "utf8")
) as {
  id: string;
  version: string;
  requiredFiles: string[];
  viewports: { name: string; width: number; height: number }[];
};

// Known-good FlowPilot artifact (mirrors the fixture in test/browserChecks.test.ts).
const FIXTURE = {
  "index.html": `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FlowPilot</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <div class="logo">FlowPilot</div>
  <nav class="nav"><a href="#features">Features</a><a href="#how">How it works</a><a href="#pricing">Pricing</a></nav>
  <button class="hamburger" aria-label="Open menu">☰</button>
</header>
<section class="hero">
  <h1>Plan less. Get more done.</h1>
  <p>FlowPilot uses AI to organize tasks.</p>
  <button class="cta">Start using FlowPilot</button>
</section>
<section id="features"><h2>Features</h2><p>AI Prioritization</p><p>Smart Planning</p><p>Focus Mode</p></section>
<section id="how"><h2>How it works</h2><p>Step 1</p><p>Step 2</p><p>Step 3</p></section>
<section class="final"><h2>Your next task is already waiting.</h2><button>Start using FlowPilot</button></section>
<footer>© 2026 FlowPilot · Privacy · Terms · Contact</footer>
<script src="script.js"></script>
</body>
</html>`,
  "style.css": `* { margin: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }
header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; }
.nav { display: flex; gap: 1rem; }
.hamburger { display: none; }
section { padding: 2rem; }
.cta:active { opacity: 0.5; }
@media (max-width: 600px) {
  .nav { display: none; }
  .hamburger { display: block; }
}`,
  "script.js": `// Toggle mobile menu
document.querySelector(".hamburger")?.addEventListener("click", () => {
  document.querySelector(".nav")?.classList.toggle("open");
});
// Visible CTA feedback
document.querySelectorAll(".cta, .final button").forEach((btn) => {
  btn.addEventListener("mousedown", () => { btn.style.opacity = "0.5"; });
});`,
};

const REQUIRED_TEXT = [
  "Plan less. Get more done.",
  "FlowPilot",
  "Your next task is already waiting.",
  "© 2026 FlowPilot",
];

function fail(message: string): never {
  console.error(`[smoke-run] FAILED: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const runId = `smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runDir = join(repoRoot, "runs", benchmark.id, runId);
  const artifactDir = join(runDir, "artifact");
  const screenshotDir = join(runDir, "screenshots");
  await mkdir(artifactDir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  for (const [rel, content] of Object.entries(FIXTURE)) {
    await writeFile(join(artifactDir, rel), content);
  }

  // --- Static checks (browser-free) ---
  const staticResults = [
    ...requiredFilesCheck(benchmark.requiredFiles, Object.keys(FIXTURE)),
    ...documentStructureCheck(FIXTURE["index.html"]),
    externalAssetCheck(FIXTURE["index.html"], FIXTURE["style.css"]),
    ...requiredContentCheck(FIXTURE["index.html"], REQUIRED_TEXT),
  ];
  const staticFailed = staticResults.filter((c) => c.status !== "passed");
  if (staticFailed.length > 0) {
    fail(`static checks: ${staticFailed.map((c) => `${c.key} (${c.status})`).join(", ")}`);
  }

  // --- Browser checks (Playwright over the preview server) ---
  const tmpRoot = await mkdtemp(join(tmpdir(), "lpbench-smoke-"));
  const pv = await startPreviewServer(artifactDir);
  let browser;
  try {
    browser = await runBrowserChecks({
      url: pv.url,
      requiredText: REQUIRED_TEXT,
      viewports: benchmark.viewports,
      hamburgerSelector: ".hamburger",
      ctaSelector: ".cta",
      screenshotDir,
      blockNetwork: true,
    });
  } finally {
    await pv.stop();
  }
  if (!browser.ok) {
    fail(
      `browser checks: ${JSON.stringify({
        consoleErrors: browser.consoleErrors,
        pageErrors: browser.pageErrors,
        missingSections: browser.missingSections,
        overflow: browser.overflow,
        interaction: browser.interaction,
      })}`
    );
  }

  // --- Normalized result (unscored: scores intentionally partial) ---
  const result = buildResult({
    runId,
    benchmark: { id: benchmark.id, version: benchmark.version },
    model: { provider: "fixture", id: "smoke-pipeline", surface: "manual" },
    generationDurationMs: 0,
    scores: {},
    artifactFiles: FIXTURE,
  });
  await writeFile(join(runDir, "result.json"), JSON.stringify(result, null, 2));
  const artifact = (result.artifact ?? undefined) as { lines?: number } | undefined;

  console.log(
    JSON.stringify(
      {
        status: "ok",
        runId,
        resultPath: join(runDir, "result.json"),
        staticChecks: staticResults.length,
        screenshots: browser.screenshots.length,
        artifactLines: artifact?.lines,
      },
      null,
      2
    )
  );
  await rm(tmpRoot, { recursive: true, force: true });
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));