/**
 * Assemble a normalized LPBench result object (`result.json`).
 *
 * Combines run identity, generation measurements, deterministic scores, and
 * derived metrics into the machine-readable contract defined by
 * `schemas/result.schema.json` (docs/RESULTS_AND_METRICS.md).
 *
 * Design rules applied:
 * - Efficiency metrics are derived ONLY when inputs are known and non-zero
 *   (returns undefined otherwise) — a cheap/fast run never gets a quality bonus.
 * - Availability is distinguished from an invented value: unknown stays unset.
 */

import {
  scorePer1kOutputTokens,
  scorePer1kTotalTokens,
  scorePerDollar,
  scorePerSecond,
  outputTokensPerSecond,
} from "../metrics/efficiency.ts";
import { measureArtifact } from "../metrics/artifact.ts";
import type { GenerationSurface } from "../types.ts";

export interface ScoreInput {
  /** Values between 0 and each rubric weight. Omitted categories are partial. */
  visual?: number;
  responsive?: number;
  functionality?: number;
  accessibility?: number;
  compliance?: number;
  codeQuality?: number;
  technical?: number;
}

export interface TokenUsageInput {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface ResultInput {
  runId: string;
  benchmark: { id: string; version: string };
  model: { provider: string; id: string; surface: GenerationSurface };
  /** milliseconds of wall-clock generation time. */
  generationDurationMs: number;
  ttftMs?: number;
  usage?: TokenUsageInput;
  scores: ScoreInput;
  /** actual API cost in USD when known (never 0 for subscription). */
  actualApiCostUsd?: number;
  billing?: "api" | "subscription" | "unknown";
  estimatedApiEquivalentUsd?: number;
  pricingDate?: string;
  /** Map of artifact file path -> content, used for LOC/bytes. */
  artifactFiles?: Record<string, string>;
}

function defined<T>(v: T | undefined): T | undefined {
  return v === undefined ? undefined : v;
}

/** Build the normalized result object. */
export function buildResult(input: ResultInput): Record<string, unknown> {
  const { scores } = input;

  // Total = sum of provided category scores. If not all categories are
  // provided this is a partial / unfinalized result, not a renormalized 100.
  const categoryEntries = [
    scores.visual,
    scores.responsive,
    scores.functionality,
    scores.accessibility,
    scores.compliance,
    scores.codeQuality,
    scores.technical,
  ];
  const total = categoryEntries.reduce<number>((sum, s) => sum + (s ?? 0), 0);

  // Derived efficiency metrics.
  const outputTokens = input.usage?.outputTokens;
  const generationSeconds = input.generationDurationMs > 0 ? input.generationDurationMs / 1000 : undefined;

  const artifact =
    input.artifactFiles && Object.keys(input.artifactFiles).length > 0
      ? (() => {
          const m = measureArtifact(input.artifactFiles as Record<string, string>);
          return { lines: m.lines, bytes: m.bytes };
        })()
      : undefined;

  const out: Record<string, unknown> = {
    runId: input.runId,
    benchmark: input.benchmark,
    model: input.model,
    generation: {
      durationMs: input.generationDurationMs,
      ...(defined(input.ttftMs) !== undefined ? { ttftMs: input.ttftMs } : {}),
      ...(input.usage && Object.keys(input.usage).length > 0 ? { usage: cleanUsage(input.usage) } : {}),
    },
    scores: { ...scores, total },
  };

  if (input.billing !== undefined || input.actualApiCostUsd !== undefined) {
    out.cost = {
      ...(defined(input.billing) !== undefined ? { billing: input.billing } : {}),
      ...(defined(input.actualApiCostUsd) !== undefined ? { actualUsd: input.actualApiCostUsd } : {}),
      ...(defined(input.estimatedApiEquivalentUsd) !== undefined
        ? { estimatedApiEquivalentUsd: input.estimatedApiEquivalentUsd }
        : {}),
      ...(defined(input.pricingDate) !== undefined ? { pricingDate: input.pricingDate } : {}),
    };
  }

  const eff: Record<string, number> = {};
  const s1kOut = scorePer1kOutputTokens(total, outputTokens);
  const s1kTot = scorePer1kTotalTokens(total, input.usage?.totalTokens);
  const perDollar = scorePerDollar(total, input.actualApiCostUsd);
  const perSec = scorePerSecond(total, generationSeconds);
  const tokPerSec = outputTokensPerSecond(outputTokens, generationSeconds);
  if (s1kOut !== undefined) eff.scorePer1kOutputTokens = s1kOut;
  if (s1kTot !== undefined) eff.scorePer1kTotalTokens = s1kTot;
  if (perDollar !== undefined) eff.scorePerDollar = perDollar;
  if (perSec !== undefined) eff.scorePerSecond = perSec;
  if (tokPerSec !== undefined) eff.outputTokensPerSecond = tokPerSec;
  if (Object.keys(eff).length > 0) out.efficiency = eff;

  if (artifact !== undefined) out.artifact = artifact;

  return out;
}

/** Strip undefined token fields so the serialized object stays clean. */
function cleanUsage(usage: TokenUsageInput): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(usage)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
