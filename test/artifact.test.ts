import { test } from "node:test";
import assert from "node:assert/strict";
import { countLines, utf8Bytes, measureArtifact } from "../src/metrics/artifact.ts";

test("countLines returns 0 for empty string", () => {
  assert.equal(countLines(""), 0);
});

test("countLines counts newline-terminated lines", () => {
  assert.equal(countLines("a\nb\nc"), 3);
  assert.equal(countLines("a\nb\nc\n"), 4);
});

test("utf8Bytes counts UTF-8 bytes (multi-byte aware)", () => {
  // ASCII: 'abc' = 3 bytes
  assert.equal(utf8Bytes("abc"), 3);
  // 'あ' (Hiragana) = 3 bytes in UTF-8
  assert.equal(utf8Bytes("あ"), 3);
  // emoji = 4 bytes
  assert.equal(utf8Bytes("😀"), 4);
});

test("measureArtifact aggregates bytes and lines across files", () => {
  const files = {
    "index.html": "<html>\n<body></body>\n</html>",
    "style.css": "body { margin: 0; }",
  };
  const m = measureArtifact(files);

  assert.equal(m.lines, 3 + 1);
  assert.equal(m.files.length, 2);
  assert.deepEqual(
    m.files.map((f) => f.path),
    ["index.html", "style.css"]
  );
  // total bytes == sum of per-file bytes
  const sum = m.files.reduce((acc, f) => acc + f.bytes, 0);
  assert.equal(m.bytes, sum);
  assert.equal(m.files[0].lines, 3);
});

test("measureArtifact handles empty artifact", () => {
  const m = measureArtifact({});
  assert.equal(m.bytes, 0);
  assert.equal(m.lines, 0);
  assert.deepEqual(m.files, []);
});
