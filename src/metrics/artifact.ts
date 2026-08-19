/**
 * Artifact size metrics for LPBench.
 *
 * Records simple implementation-size metrics for a generated artifact:
 * - generated lines of code (LOC)
 * - total artifact bytes
 * - optionally per-file bytes / LOC
 *
 * These values are descriptive only. A shorter implementation is not
 * automatically better (docs/RESULTS_AND_METRICS.md).
 */

export interface FileMetrics {
  path: string;
  bytes: number;
  lines: number;
}

export interface ArtifactMetrics {
  bytes: number;
  lines: number;
  files: FileMetrics[];
}

/** Number of newline-terminated lines in UTF-8 content. */
export function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.split("\n").length;
}

/** Bytes of a UTF-8 string (uses the runtime TextEncoder, no Node dependency). */
export function utf8Bytes(content: string): number {
  return new TextEncoder().encode(content).length;
}

/**
 * Compute size metrics from a map of file path -> content.
 *
 * @param files A record of relative artifact path (e.g. "index.html") to file content.
 */
export function measureArtifact(files: Record<string, string>): ArtifactMetrics {
  const fileMetrics: FileMetrics[] = Object.entries(files).map(([path, content]) => ({
    path,
    bytes: utf8Bytes(content),
    lines: countLines(content),
  }));

  return {
    bytes: fileMetrics.reduce((sum, f) => sum + f.bytes, 0),
    lines: fileMetrics.reduce((sum, f) => sum + f.lines, 0),
    files: fileMetrics,
  };
}
