/**
 * OpenAI API runner (docs/ARCHITECTURE.md "Runner").
 *
 * Turns a benchmark prompt into a normalized `GenerationResult` via the OpenAI
 * Chat Completions API. The model is asked to return exactly the required
 * artifact files as a JSON object; the runner writes those files to the output
 * directory and normalizes provider-reported usage and timing.
 *
 * Security contract (docs/SECURITY.md): the API key is read only from
 * constructor options or `OPENAI_API_KEY`, is never serialized into the
 * result, and `providerRaw` is sanitized (only `finishReason`) — never the raw
 * response body.
 *
 * Cost is NOT computed here: runners must not score or price (that is the
 * metrics/pricing domain, consumed at result assembly).
 */

import { mkdir, writeFile } from "node:fs/promises";
import type { BenchmarkInput, BenchmarkRunner, GenerationResult, TokenUsage } from "../types.ts";

export interface OpenAiRunnerOptions {
  /** API key. Defaults to `process.env.OPENAI_API_KEY`. */
  apiKey?: string;
  /** Chat model id. Default `gpt-4o-mini`. */
  model?: string;
  /** API base URL (default `https://api.openai.com/v1`). Injectable for tests. */
  baseUrl?: string;
  /** Generation timeout in ms (docs/SECURITY.md resource limits). Default 120000. */
  timeoutMs?: number;
  /** Injectable fetch implementation (default `globalThis.fetch`). */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_MODEL = "gpt-4o-mini";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_TIMEOUT_MS = 120_000;

/** Build the system prompt that pins the file-output JSON contract. */
export function buildFileContractSystemPrompt(requiredFiles: string[]): string {
  const files = requiredFiles.map((f) => `"${f}"`).join(", ");
  return [
    "You are a web artifact generator. Respond with a single JSON object ONLY.",
    "No markdown, no code fences, no commentary.",
    "Keys are file paths; values are the complete file contents.",
    `The object must contain exactly these keys: ${files}.`,
    "Do not include any other keys.",
  ].join(" ");
}

/** Send a fetch request with an overall timeout (AbortController). */
async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Truncated error body for actionable API error messages (no secrets expected). */
async function errorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
  } catch {
    return "(could not read error body)";
  }
}

export interface ChatCompletionUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface ParsedChatCompletion {
  model?: string;
  finishReason?: string;
  content: string;
  usage?: ChatCompletionUsage;
}

const asNonNegative = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

/** Normalize an OpenAI chat completion response. Throws on unusable shapes. */
export function parseChatCompletion(data: unknown): ParsedChatCompletion {
  if (typeof data !== "object" || data === null) {
    throw new Error("OpenAiRunner: response is not a JSON object");
  }
  const d = data as Record<string, unknown>;
  const choice =
    Array.isArray(d.choices) && d.choices.length > 0
      ? (d.choices[0] as Record<string, unknown> | undefined)
      : undefined;
  const message =
    choice && typeof choice.message === "object" && choice.message !== null
      ? (choice.message as Record<string, unknown>)
      : undefined;
  const content = typeof message?.content === "string" ? message.content : undefined;
  if (content === undefined || content === "") {
    throw new Error("OpenAiRunner: response contains no message content");
  }
  const usageRaw = (typeof d.usage === "object" && d.usage !== null ? d.usage : {}) as Record<string, unknown>;
  const promptDetails =
    typeof usageRaw.prompt_tokens_details === "object" && usageRaw.prompt_tokens_details !== null
      ? (usageRaw.prompt_tokens_details as Record<string, unknown>)
      : {};
  const completionDetails =
    typeof usageRaw.completion_tokens_details === "object" && usageRaw.completion_tokens_details !== null
      ? (usageRaw.completion_tokens_details as Record<string, unknown>)
      : {};
  const usage: ChatCompletionUsage = {};
  const input = asNonNegative(usageRaw.prompt_tokens);
  const output = asNonNegative(usageRaw.completion_tokens);
  const total = asNonNegative(usageRaw.total_tokens);
  if (input !== undefined) usage.inputTokens = input;
  if (output !== undefined) usage.outputTokens = output;
  if (total !== undefined) usage.totalTokens = total;
  const cached = asNonNegative(promptDetails.cached_tokens);
  const reasoning = asNonNegative(completionDetails.reasoning_tokens);
  if (cached !== undefined) usage.cachedTokens = cached;
  if (reasoning !== undefined) usage.reasoningTokens = reasoning;

  return {
    model: typeof d.model === "string" ? d.model : undefined,
    finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined,
    content,
    usage: Object.keys(usage).length > 0 ? usage : undefined,
  };
}

/**
 * Parse the model's content into artifact files, tolerating markdown code
 * fences. Throws listing every missing required file.
 */
export function extractArtifactFiles(
  content: string,
  requiredFiles: string[]
): Record<string, string> {
  const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // Last resort: take the widest {...} span if the model padded output.
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(stripped.slice(start, end + 1));
      } catch {
        throw new Error("OpenAiRunner: model output is not valid JSON");
      }
    } else {
      throw new Error("OpenAiRunner: model output is not valid JSON");
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("OpenAiRunner: JSON response must be an object mapping file -> content");
  }
  const files = parsed as Record<string, unknown>;
  const missing = requiredFiles.filter((f) => typeof files[f] !== "string");
  if (missing.length > 0) {
    throw new Error(`OpenAiRunner: response missing required file(s): ${missing.join(", ")}`);
  }
  const out: Record<string, string> = {};
  for (const f of requiredFiles) out[f] = files[f] as string;
  return out;
}

async function writeArtifactFiles(outputDir: string, files: Record<string, string>): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(`${outputDir}/${rel}`, content);
  }
}

export class OpenAiRunner implements BenchmarkRunner {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAiRunnerOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = opts.model ?? DEFAULT_MODEL;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  }

  async generate(input: BenchmarkInput): Promise<GenerationResult> {
    if (!this.apiKey) {
      throw new Error(
        "OpenAiRunner: OPENAI_API_KEY is not set (pass options.apiKey or set the environment variable)"
      );
    }
    if (!input.requiredFiles || input.requiredFiles.length === 0) {
      throw new Error("OpenAiRunner: BenchmarkInput.requiredFiles must list the artifact files to generate");
    }

    const startedAt = new Date();
    const startedIso = startedAt.toISOString();

    let res: Response;
    try {
      res = await fetchWithTimeout(
        this.fetchImpl,
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: "system", content: buildFileContractSystemPrompt(input.requiredFiles) },
              { role: "user", content: input.prompt },
            ],
            response_format: { type: "json_object" },
          }),
        },
        this.timeoutMs
      );
    } catch (err) {
      const reason = err instanceof Error && err.name === "AbortError"
        ? `timed out after ${this.timeoutMs}ms`
        : err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAiRunner: request failed (${reason})`);
    }

    if (!res.ok) {
      throw new Error(`OpenAiRunner: API error ${res.status}: ${await errorBody(res)}`);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error("OpenAiRunner: API response is not valid JSON");
    }

    const parsed = parseChatCompletion(data);
    const files = extractArtifactFiles(parsed.content, input.requiredFiles);
    await writeArtifactFiles(input.outputDir, files);

    const finishedAt = new Date();
    return {
      artifactPath: input.outputDir,
      model: { provider: "openai", id: parsed.model ?? this.model, surface: "api" },
      usage: parsed.usage as TokenUsage | undefined,
      timing: {
        startedAt: startedIso,
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
      // Sanitized raw metadata only — never the response body (docs/SECURITY.md).
      providerRaw: parsed.finishReason !== undefined ? { finishReason: parsed.finishReason } : undefined,
    };
  }
}