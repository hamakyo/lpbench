import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// ajv/dist/2020 is the draft 2020-12 build needed for our $schema (see result.schema.json).
const Ajv2020: any = require("ajv/dist/2020");

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function load(rel: string): unknown {
  return JSON.parse(readFileSync(join(repoRoot, rel), "utf8"));
}

// Compile once; Ajv throws on invalid schemas, so compilation itself asserts schema validity.
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validateBenchmark = ajv.compile(load("schemas/benchmark.schema.json"));
const validateRubric = ajv.compile(load("schemas/rubric.schema.json"));

test("benchmark.schema.json accepts the real benchmarks/lp/v1/benchmark.json", () => {
  const benchmark = load("benchmarks/lp/v1/benchmark.json");
  assert.equal(validateBenchmark(benchmark), true, JSON.stringify(validateBenchmark.errors));
});

test("rubric.schema.json accepts the real benchmarks/lp/v1/rubric.json", () => {
  const rubric = load("benchmarks/lp/v1/rubric.json");
  assert.equal(validateRubric(rubric), true, JSON.stringify(validateRubric.errors));
});

test("benchmark.schema.json rejects a missing required field", () => {
  const bad = { name: "No id", version: "1.0.0", requiredFiles: ["index.html"], viewports: [] };
  assert.equal(validateBenchmark(bad), false);
});

test("benchmark.schema.json rejects an empty requiredFiles array", () => {
  const bad = { id: "x", name: "x", version: "1", requiredFiles: [], viewports: [{ name: "d", width: 1440, height: 900 }] };
  assert.equal(validateBenchmark(bad), false);
});

test("benchmark.schema.json rejects a viewport with non-positive size", () => {
  const bad = {
    id: "x",
    name: "x",
    version: "1",
    requiredFiles: ["index.html"],
    viewports: [{ name: "d", width: 0, height: 900 }],
  };
  assert.equal(validateBenchmark(bad), false);
});

test("benchmark.schema.json rejects unknown properties", () => {
  const bad = {
    id: "x",
    name: "x",
    version: "1",
    requiredFiles: ["index.html"],
    viewports: [{ name: "d", width: 1440, height: 900 }],
    surprise: true,
  };
  assert.equal(validateBenchmark(bad), false);
});

test("rubric.schema.json rejects a category weight that is not a number", () => {
  const bad = { total: 100, categories: { visual: "high", responsive: 0 } };
  assert.equal(validateRubric(bad), false);
});

test("rubric.schema.json rejects a missing required category", () => {
  const bad = { total: 100, categories: { visual: 25 } };
  assert.equal(validateRubric(bad), false);
});
