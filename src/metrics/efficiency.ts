/**
 * Efficiency metrics for LPBench.
 *
 * Derived metrics are computed ONLY when their inputs are known and non-zero.
 * If an input is missing, null, or non-positive, the corresponding metric
 * returns `undefined` rather than a fabricated value (design principle #4:
 * "Do not invent unavailable measurements").
 *
 * Quality score and efficiency metrics must remain separate so cheap or fast
 * runs do not receive artificial quality bonuses (design principle #3).
 *
 * Contract: docs/RESULTS_AND_METRICS.md
 */

/** Non-negative, finite number guard. Returns the value when usable, else undefined. */
function usableNumber(value: number | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function divide(numerator: number | undefined | null, denominator: number | undefined | null): number | undefined {
  const num = usableNumber(numerator);
  const den = usableNumber(denominator);
  if (num === undefined || den === undefined) return undefined;
  return num / den;
}

/**
 * Quality per 1K output tokens: qualityScore / outputTokens * 1000.
 * Undefined when outputTokens is unknown/zero.
 */
export function scorePer1kOutputTokens(qualityScore: number, outputTokens: number | undefined | null): number | undefined {
  const tokens = usableNumber(outputTokens);
  const score = usableNumber(qualityScore);
  if (tokens === undefined || score === undefined) return undefined;
  return (score / tokens) * 1000;
}

/**
 * Quality per 1K total tokens: qualityScore / totalTokens * 1000.
 * Useful when input/context size differs between benchmark configurations.
 */
export function scorePer1kTotalTokens(qualityScore: number, totalTokens: number | undefined | null): number | undefined {
  const tokens = usableNumber(totalTokens);
  const score = usableNumber(qualityScore);
  if (tokens === undefined || score === undefined) return undefined;
  return (score / tokens) * 1000;
}

/**
 * Quality per dollar: qualityScore / actualApiCostUsd.
 * Only valid when actual API cost is known. Never use subscription cost as zero.
 */
export function scorePerDollar(qualityScore: number, actualApiCostUsd: number | undefined | null): number | undefined {
  return divide(qualityScore, actualApiCostUsd);
}

/**
 * Quality per second: qualityScore / generationSeconds.
 * Captures the quality/latency trade-off.
 */
export function scorePerSecond(qualityScore: number, generationSeconds: number | undefined | null): number | undefined {
  return divide(qualityScore, generationSeconds);
}

/**
 * Output tokens per second: outputTokens / generationSeconds.
 * A throughput metric, not a quality metric.
 */
export function outputTokensPerSecond(outputTokens: number | undefined | null, generationSeconds: number | undefined | null): number | undefined {
  return divide(outputTokens, generationSeconds);
}
