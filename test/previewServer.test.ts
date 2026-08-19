import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPreviewServer, type PreviewServer } from "../src/runners/previewServer.ts";

async function makeArtifact(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lpbench-preview-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(join(p, ".."), { recursive: true });
    await writeFile(p, content);
  }
  return dir;
}

async function withServer(
  root: string,
  fn: (pv: PreviewServer) => Promise<void>
): Promise<void> {
  const pv = await startPreviewServer(root);
  try {
    await fn(pv);
  } finally {
    await pv.stop();
  }
}

function get(pv: PreviewServer, path: string): Promise<{ status: number; body: string; type: string }> {
  return fetch(pv.url + path.slice(1)).then(async (r) => ({
    status: r.status,
    body: await r.text(),
    type: r.headers.get("content-type") ?? "",
  }));
}

test("binds to loopback by default and serves index.html at /", async () => {
  const root = await makeArtifact({
    "index.html": "<h1>hi</h1>",
    "style.css": "body{}",
    "script.js": "console.log(1)",
  });
  await withServer(root, async (pv) => {
    assert.ok(pv.url.startsWith("http://127.0.0.1:"), `unexpected url ${pv.url}`);
    const res = await get(pv, "/");
    assert.equal(res.status, 200);
    assert.equal(res.body, "<h1>hi</h1>");
    assert.match(res.type, /text\/html/);
  });
});

test("serves css and js with correct content types", async () => {
  const root = await makeArtifact({
    "index.html": "<html></html>",
    "style.css": ".a{}",
    "script.js": "void 0",
  });
  await withServer(root, async (pv) => {
    const css = await get(pv, "/style.css");
    assert.equal(css.status, 200);
    assert.match(css.type, /text\/css/);

    const js = await get(pv, "/script.js");
    assert.equal(js.status, 200);
    assert.match(js.type, /javascript/);
  });
});

test("serves implicit index.html for directory path", async () => {
  const root = await makeArtifact({
    "index.html": "root",
    "app/index.html": "nested",
  });
  await withServer(root, async (pv) => {
    const res = await get(pv, "/app/");
    assert.equal(res.status, 200);
    assert.equal(res.body, "nested");
  });
});

test("never serves files outside the artifact root", async () => {
  const outside = await mkdtemp(join(tmpdir(), "lpbench-outside-"));
  await writeFile(join(outside, "secret.txt"), "SECRET-CONTENT");
  const root = await mkdtemp(join(tmpdir(), "lpbench-root-"));
  await writeFile(join(root, "index.html"), "ok");

  await withServer(root, async (pv) => {
    // Raw ../../ (URL-normalized by fetch/URL, so lands inside root -> 404).
    const raw = await get(pv, "/../../" + outside.split("/").pop() + "/secret.txt");
    // Encoded %2e%2e form reaches the traversal guard -> 400/404.
    const encoded = await get(pv, "/%2e%2e/%2e%2e/" + outside.split("/").pop() + "/secret.txt");

    const statuses = [raw.status, encoded.status];
    for (const s of statuses) {
      assert.ok(s === 400 || s === 404, `expected 400/404 but got ${s}`);
    }
    assert.notEqual(raw.body, "SECRET-CONTENT");
    assert.notEqual(encoded.body, "SECRET-CONTENT");
  });
});

test("rejects encoded path traversal (%2e%2e)", async () => {
  const root = await makeArtifact({ "index.html": "ok" });
  await withServer(root, async (pv) => {
    const res = await get(pv, "/%2e%2e/%2e%2e/etc/passwd");
    // decoded to ../../etc/passwd -> escapes -> 400 (or 404 if node flags it)
    assert.ok(res.status === 400 || res.status === 404, `status was ${res.status}`);
  });
});

test("returns 404 for missing file", async () => {
  const root = await makeArtifact({ "index.html": "ok" });
  await withServer(root, async (pv) => {
    const res = await get(pv, "/nope.html");
    assert.equal(res.status, 404);
  });
});

test("returns 405 for non-GET/HEAD methods", async () => {
  const root = await makeArtifact({ "index.html": "ok" });
  const pv = await startPreviewServer(root);
  try {
    const res = await fetch(pv.url, { method: "POST", body: "x" });
    assert.equal(res.status, 405);
  } finally {
    await pv.stop();
  }
});

test("stop() reliably closes the server", async () => {
  const root = await makeArtifact({ "index.html": "ok" });
  const pv = await startPreviewServer(root);
  await pv.stop();
  await assert.rejects(fetch(pv.url), (err: unknown) => {
    // connection refused / rejected after close is acceptable
    return true;
  });
});

test("supports explicit host and port options", async () => {
  const root = await makeArtifact({ "index.html": "ok" });
  const pv = await startPreviewServer(root, { host: "127.0.0.1" });
  try {
    assert.ok(pv.port > 0);
    assert.equal(pv.url, `http://127.0.0.1:${pv.port}/`);
    const res = await get(pv, "/");
    assert.equal(res.status, 200);
  } finally {
    await pv.stop();
  }
});
