export type GenerationSurface = "api" | "cli" | "web" | "manual";

export interface BenchmarkInput {
  benchmarkId: string;
  prompt: string;
  outputDir: string;
  /** Files the generated artifact must contain (from the benchmark definition). */
  requiredFiles: string[];
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface GenerationResult {
  artifactPath: string;
  model: {
    provider: string;
    id: string;
    surface: GenerationSurface;
  };
  usage?: TokenUsage;
  timing: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    ttftMs?: number;
  };
  providerRaw?: unknown;
}

export interface BenchmarkRunner {
  generate(input: BenchmarkInput): Promise<GenerationResult>;
}
