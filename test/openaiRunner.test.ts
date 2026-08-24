import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OpenAiRunner,
  buildFileContractSystemPrompt,
  extractArtifactFiles,
  parseChatCompletion,
} from "../src/runners/openaiRunner.ts";

const REQUIRED_FILES = ["index.html", "style.css", "script.js"];

const ARTIFACT_JSON = JSON.stringify({
  "index.html": "<html><body>hi</body></html>",
  "style.css": "body { color: #333 }",
  "script.js": "console.log('lpbench');",
});

const FIXTURE_RESPONSE = {
  id: "chatcmpl-fake",
  object: "chat.completion",
  model: "gpt-4o-mini",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: ARTIFACT_JSON },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 1200,
    completion_tokens: 900,
    total_tokens: 2100,
    prompt_tokens_details: { cached_tokens: 200 },
    completion_tokens_details: { reasoning_tokens: 100 },
  },
};

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function mockFetch(
  captured: CapturedRequest[],
  opts: { status?: number; body?: unknown; signalAware?: boolean } = {}
): typeof fetch {
  const { status = 200, body = FIXTURE_RESPONSE, signalAware = false } = opts;
  return (async (url: unknown, init: unknown) => {
    const r = init as RequestInit;
    const req: CapturedRequest = {
      url: String(url),
      method: r.method ?? "GET",
      headers: (r.headers as Record<string, string>) ?? {},
      body: (() => {
        try {
          return JSON.parse(String(r.body));
        } catch {
          return { raw: String(r.body) };
        }
      })(),
    };
    captured.push(req);
    if (signalAware && r.signal) {
      await new Promise<never>((_, reject) => {
        r.signal!.addEventListener("abort", () => {
          const e = new Error("Aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function input(overrides: Partial<Parameters<OpenAiRunner["generate"]>[0]> = {}) {
  return {
    benchmarkId: "lp-v1",
    prompt: "Create a landing page.",
    outputDir: join(tmpdir(), `lpbench-runner-${Math.random().toString(36).slice(2)}`),
    requiredFiles: REQUIRED_FILES,
    ...overrides,
  };
}

test("generate: writes artifact files and returns a normalized GenerationResult", async () => {
  const captured: CapturedRequest[] = [];
  const runner = new OpenAiRunner({ apiKey: "test-key", fetchImpl: mockFetch(captured) });
  const res = await runner.generate(input());

  // Request contract
  assert.equal(captured.length, 1);
  assert.ok(captured[0].url.endsWith("/chat/completions"), captured[0].url);
  assert.equal(captured[0].method, "POST");
  assert.equal(captured[0].headers.Authorization, "Bearer test-key");
  const body = captured[0].body;
  assert.equal(body.model, "gpt-4o-mini");
  assert.deepEqual(body.response_format, { type: "json_object" });
  const messages = body.messages as { role: string; content: string }[];
  assert.equal(messages[1].content, "Create a landing page.");
  assert.ok(messages[0].content.includes('"index.html"'));

  // Normalized result
  assert.equal(res.model.provider, "openai");
  assert.equal(res.model.id, "gpt-4o-mini");
  assert.equal(res.model.surface, "api");
  assert.equal(res.timing.durationMs >= 0, true);
  assert.ok(Number.isFinite(Date.parse(res.timing.startedAt)));
  assert.ok(Number.isFinite(Date.parse(res.timing.finishedAt)));
  assert.deepEqual(res.usage, {
    inputTokens: 1200,
    outputTokens: 900,
    totalTokens: 2100,
    cachedTokens: 200,
    reasoningTokens: 100,
  });
  assert.deepEqual(res.providerRaw, { finishReason: "stop" });

  // Files on disk
  const files = (await readdir(res.artifactPath)).sort();
  assert.deepEqual(files, [...REQUIRED_FILES].sort());
  assert.equal(await readFile(join(res.artifactPath, "index.html"), "utf8"), "<html><body>hi</body></html>");
  await rm(res.artifactPath, { recursive: true, force: true });
});

test("generate: uses options model and baseUrl", async () => {
  const captured: CapturedRequest[] = [];
  const runner = new OpenAiRunner({
    apiKey: "k",
    model: "gpt-5",
    baseUrl: "https://example.test/v1/",
    fetchImpl: mockFetch(captured),
  });
  const res = await runner.generate(input());
  assert.ok(captured[0].url.startsWith("https://example.test/v1/chat/completions"));
  assert.equal(captured[0].body.model, "gpt-5");
  assert.equal(res.model.id, "gpt-4o-mini"); // response model wins over option
});

test("generate: parses markdown-fenced JSON", async () => {
  const captured: CapturedRequest[] = [];
  const fenced = { ...FIXTURE_RESPONSE } as Record<string, unknown>;
  fenced.choices = [
    { ...(fenced.choices as Record<string, unknown>[])[0], message: { role: "assistant", content: "```json\n" + ARTIFACT_JSON + "\n```" } },
  ];
  const runner = new OpenAiRunner({ apiKey: "k", fetchImpl: mockFetch(captured, { body: fenced }) });
  const res = await runner.generate(input());
  assert.deepEqual((await readdir(res.artifactPath)).sort(), [...REQUIRED_FILES].sort());
  await rm(res.artifactPath, { recursive: true, force: true });
});

test("generate: rejects when a required file is missing (before writing)", async () => {
  const captured: CapturedRequest[] = [];
  const partial = { ...FIXTURE_RESPONSE } as Record<string, unknown>;
  partial.choices = [
    {
      ...(partial.choices as Record<string, unknown>[])[0],
      message: { role: "assistant", content: JSON.stringify({ "index.html": "<p>x</p>" }) },
    },
  ];
  const runner = new OpenAiRunner({ apiKey: "k", fetchImpl: mockFetch(captured, { body: partial }) });
  const outDir = join(tmpdir(), `lpbench-runner-missing-${Date.now()}`);
  await assert.rejects(runner.generate(input({ outputDir: outDir })), /missing required file\(s\): style\.css, script\.js/);
  assert.deepEqual(await readdir(outDir).catch(() => []), [], "nothing written on failure");
});

test("generate: rejects invalid JSON content", async () => {
  const captured: CapturedRequest[] = [];
  const bad = { ...FIXTURE_RESPONSE } as Record<string, unknown>;
  bad.choices = [{ ...(bad.choices as Record<string, unknown>[])[0], message: { role: "assistant", content: "not json at all" } }];
  const runner = new OpenAiRunner({ apiKey: "k", fetchImpl: mockFetch(captured, { body: bad }) });
  await assert.rejects(runner.generate(input()), /not valid JSON/);
});

test("generate: requires an API key before any request", async () => {
  let calls = 0;
  const spy = (async () => {
    calls += 1;
    return new Response("{}");
  }) as typeof fetch;
  const runner = new OpenAiRunner({ apiKey: "", fetchImpl: spy });
  await assert.rejects(runner.generate(input()), /OPENAI_API_KEY is not set/);
  assert.equal(calls, 0, "no request without a key");
});

test("generate: surfaces API errors with status", async () => {
  const captured: CapturedRequest[] = [];
  const runner = new OpenAiRunner({
    apiKey: "k",
    fetchImpl: mockFetch(captured, { status: 401, body: { error: { message: "bad key" } } }),
  });
  await assert.rejects(runner.generate(input()), (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    assert.match(msg, /API error 401/);
    assert.match(msg, /bad key/);
    return true;
  });
});

test("generate: times out and reports it", async () => {
  const captured: CapturedRequest[] = [];
  const runner = new OpenAiRunner({
    apiKey: "k",
    timeoutMs: 50,
    fetchImpl: mockFetch(captured, { signalAware: true }),
  });
  await assert.rejects(runner.generate(input()), /timed out after 50ms/);
});

test("generate: usage absent stays unknown (not invented)", async () => {
  const captured: CapturedRequest[] = [];
  const noUsage = { ...FIXTURE_RESPONSE } as Record<string, unknown>;
  delete noUsage.usage;
  const runner = new OpenAiRunner({ apiKey: "k", fetchImpl: mockFetch(captured, { body: noUsage }) });
  const res = await runner.generate(input());
  assert.equal(res.usage, undefined);
  await rm(res.artifactPath, { recursive: true, force: true });
});

test("generate: requires requiredFiles", async () => {
  const runner = new OpenAiRunner({ apiKey: "k", fetchImpl: mockFetch([]) });
  await assert.rejects(runner.generate(input({ requiredFiles: [] })), /requiredFiles must list/);
});

// --- pure helpers ---

test("buildFileContractSystemPrompt pins the file contract", () => {
  const prompt = buildFileContractSystemPrompt(["index.html", "style.css"]);
  assert.ok(prompt.includes('"index.html"'));

  assert.ok(prompt.includes('"style.css"'));
  assert.ok(prompt.toLowerCase().includes("json"));
});

test("extractArtifactFiles tolerates fences and extra keys are ignored", () => {
  const files = extractArtifactFiles("```json\n" + ARTIFACT_JSON + "\n```", REQUIRED_FILES);
  assert.deepEqual(Object.keys(files), REQUIRED_FILES);
  const extra = extractArtifactFiles(JSON.stringify({ ...JSON.parse(ARTIFACT_JSON), "README.md": "x" }), REQUIRED_FILES);
  assert.deepEqual(Object.keys(extra), REQUIRED_FILES, "extra keys not written");
  assert.throws(() => extractArtifactFiles("nope", REQUIRED_FILES), /not valid JSON/);
  assert.throws(() => extractArtifactFiles(JSON.stringify([1, 2]), REQUIRED_FILES), /object mapping file/);
});

test("parseChatCompletion normalizes usage and sanitizes raw", () => {
  const parsed = parseChatCompletion(FIXTURE_RESPONSE);
  assert.equal(parsed.content, ARTIFACT_JSON);
  assert.equal(parsed.finishReason, "stop");
  assert.deepEqual(parsed.usage, {
    inputTokens: 1200,
    outputTokens: 900,
    totalTokens: 2100,
    cachedTokens: 200,
    reasoningTokens: 100,
  });
  const empty = parseChatCompletion({ choices: [{ message: { content: "x" } }] });
  assert.equal(empty.usage, undefined);
  assert.throws(() => parseChatCompletion({}), /no message content/);
  assert.throws(() => parseChatCompletion("nope"), /not a JSON object/);
});