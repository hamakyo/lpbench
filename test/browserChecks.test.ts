import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPreviewServer } from "../src/runners/previewServer.ts";
import { runBrowserChecks, type BenchmarkViewport } from "../src/evaluators/browserChecks.ts";

const VIEWPORTS: BenchmarkViewport[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
];

const GOOD_HTML = `<!doctype html>
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
</html>`;

const GOOD_CSS = `* { margin: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }
header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; }
.nav { display: flex; gap: 1rem; }
.hamburger { display: none; }
section { padding: 2rem; }
.cta:active { opacity: 0.5; }
@media (max-width: 600px) {
  .nav { display: none; }
  .hamburger { display: block; }
}`;

const GOOD_JS = `// Toggle mobile menu
document.querySelector(".hamburger")?.addEventListener("click", () => {
  document.querySelector(".nav")?.classList.toggle("open");
});
// Visible CTA feedback
document.querySelectorAll(".cta, .final button").forEach((btn) => {
  btn.addEventListener("mousedown", () => { btn.style.opacity = "0.5"; });
});`;

// Bad artifact: logs a console error, overflows horizontally, missing required
// copy, and has no working hamburger interaction.
const BAD_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Bad</title><style>body{width:2000px}</style></head>
<body>
<h1>Not the right heading</h1>
<p>missing the rest</p>
<script>console.error("boom"); document.querySelector(".nope").click();</script>
</body>
</html>`;

async function writeArtifact(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lpbench-browser-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(join(p, ".."), { recursive: true });
    await writeFile(p, content);
  }
  return dir;
}

async function serveAndCheck(files: Record<string, string>, opts: Partial<Parameters<typeof runBrowserChecks>[0]> = {}) {
  const root = await writeArtifact(files);
  const pv = await startPreviewServer(root);
  try {
    return await runBrowserChecks({
      url: pv.url,
      requiredText: ["Plan less. Get more done.", "FlowPilot", "© 2026 FlowPilot"],
      viewports: VIEWPORTS,
      hamburgerSelector: ".hamburger",
      ctaSelector: ".cta",
      blockNetwork: true,
      ...opts,
    });
  } finally {
    await pv.stop();
  }
}

test("browser checks pass for a clean FlowPilot-style artifact", async () => {
  const result = await serveAndCheck({
    "index.html": GOOD_HTML,
    "style.css": GOOD_CSS,
    "script.js": GOOD_JS,
  });
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.deepEqual(result.consoleErrors, []);
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.missingSections, []);
  assert.deepEqual(result.overflow, []);
  assert.equal(result.interaction.hamburgerOpened, true);
  assert.equal(result.interaction.ctaFeedback, true);
});

test("browser checks capture console errors, overflow, and missing sections", async () => {
  const result = await serveAndCheck({ "index.html": BAD_HTML });
  assert.equal(result.ok, false);
  assert.ok(result.consoleErrors.some((e) => e.includes("boom")), "console error captured");
  assert.ok(result.pageErrors.length > 0, "page error (thrown from dead click) captured");
  assert.ok(result.missingSections.length > 0, "required copy missing");
  assert.ok(result.overflow.length > 0, "horizontal overflow flagged");
});

test("browser checks capture screenshots when a dir is provided", async () => {
  const shotDir = await mkdtemp(join(tmpdir(), "lpbench-shots-"));
  const result = await serveAndCheck(
    { "index.html": GOOD_HTML, "style.css": GOOD_CSS, "script.js": GOOD_JS },
    { screenshotDir: shotDir }
  );
  assert.equal(result.screenshots.length, VIEWPORTS.length);
  for (const s of result.screenshots) {
    assert.ok(s.path.startsWith(shotDir), `path in dir: ${s.path}`);
    const { stat } = await import("node:fs/promises");
    const st = await stat(s.path);
    assert.ok(st.size > 0, `screenshot non-empty: ${s.path}`);
  }
});
