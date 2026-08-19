import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requiredFilesCheck,
  findHtmlExternalReferences,
  findCssExternalReferences,
  externalAssetCheck,
  requiredContentCheck,
  documentStructureCheck,
} from "../src/evaluators/staticChecks.ts";

test("requiredFilesCheck passes when all files present", () => {
  const items = requiredFilesCheck(
    ["index.html", "style.css", "script.js"],
    ["index.html", "style.css", "script.js"]
  );
  assert.equal(items.length, 3);
  assert.ok(items.every((i) => i.status === "passed"));
});

test("requiredFilesCheck fails on missing file", () => {
  const items = requiredFilesCheck(["index.html", "style.css"], ["index.html"]);
  const css = items.find((i) => i.key === "required-file:style.css");
  assert.equal(css?.status, "failed");
});

test("findHtmlExternalReferences detects script/link/img and inline URLs", () => {
  const html = `
    <html><head>
      <link rel="stylesheet" href="/local.css">
      <link rel="stylesheet" href="https://cdn.example.com/app.css">
    </head><body>
      <script src="app.js"></script>
      <script src="//cdn.example.com/lib.js"></script>
      <img src="/img/logo.png">
      <img src="https://img.example.com/x.png">
    </body></html>
  `;
  const refs = findHtmlExternalReferences(html);
  const urls = refs.map((r) => r.url);
  assert.ok(urls.includes("https://cdn.example.com/app.css"));
  assert.ok(urls.includes("//cdn.example.com/lib.js"));
  assert.ok(urls.includes("https://img.example.com/x.png"));
  // Local refs must NOT be flagged.
  assert.ok(!urls.includes("/local.css"));
  assert.ok(!urls.includes("app.js"));
  assert.ok(!urls.includes("/img/logo.png"));
});

test("findCssExternalReferences detects external and data urls", () => {
  const css = `
    @font-face { src: url("https://fonts.example.com/x.woff2"); }
    .bg { background: url("/local/bg.png"); }
    .icon { background: url(data:image/svg+xml;base64,AAAA); }
  `;
  const refs = findCssExternalReferences(css);
  const urls = refs.map((r) => r.url);
  assert.ok(urls.some((u) => u.startsWith("https://fonts.example.com")));
  assert.ok(urls.some((u) => u.startsWith("data:")));
  assert.ok(!urls.some((u) => u.startsWith("/local/bg.png")));
});

test("externalAssetCheck passes for self-contained artifact", () => {
  const html = `<html><body><script src="app.js"></script></body></html>`;
  const css = `.a { color: red; }`;
  const check = externalAssetCheck(html, css);
  assert.equal(check.status, "passed");
});

test("externalAssetCheck fails when external reference present", () => {
  const html = `<html><body><script src="https://cdn.example.com/lib.js"></script></body></html>`;
  const css = `.a { color: red; }`;
  const check = externalAssetCheck(html, css);
  assert.equal(check.status, "failed");
  assert.match(check.detail ?? "", /cdn\.example\.com/);
});

test("requiredContentCheck matches benchmark copy", () => {
  const html = `
    <h1>Plan less. Get more done.</h1>
    <footer>© 2026 FlowPilot</footer>
  `;
  const items = requiredContentCheck(html, ["Plan less. Get more done.", "© 2026 FlowPilot", "Missing Section"]);
  const foundItems = items.filter((i) => i.status === "passed");
  assert.equal(foundItems.length, 2);
});

test("documentStructureCheck validates html/head/body/viewport", () => {
  const good = `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body></body></html>`;
  const items = documentStructureCheck(good);
  assert.equal(items.length, 4);
  assert.ok(items.every((i) => i.status === "passed"));

  const bare = `plain text with no tags`;
  const bareItems = documentStructureCheck(bare);
  assert.ok(bareItems.every((i) => i.status === "failed"));
});
