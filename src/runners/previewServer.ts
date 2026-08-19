/**
 * Local preview server for generated (untrusted) artifacts.
 *
 * Serves the files of a single artifact directory over an isolated loopback
 * HTTP origin so the browser can evaluate them with HTTP semantics.
 *
 * Security contract (docs/SECURITY.md):
 * - serves ONLY the given artifact directory; never resolves outside it
 * - rejects path traversal and directory escapes
 * - binds to loopback (127.0.0.1) by default
 * - shuts down reliably via the returned stop()
 * - does not expose secrets / env vars to the served code
 *
 * The generated page must never be trusted: no dynamic templating, no
 * server-side inclusion, no access beyond the static file being requested.
 */

import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep, extname } from "node:path";

export interface PreviewServer {
  /** Base URL like `http://127.0.0.1:<port>/`. */
  url: string;
  /** Bound port. */
  port: number;
  /** Stops the server; resolves once fully closed. */
  stop(): Promise<void>;
}

export interface PreviewServerOptions {
  /** Host to bind to. Defaults to loopback (127.0.0.1). */
  host?: string;
  /** Port to bind. Defaults to 0 (ephemeral). */
  port?: number;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Resolve a request path safely inside `rootDir`.
 * Returns `null` when the path escapes the root (path traversal).
 */
function resolveSafe(rootDir: string, urlPath: string): string | null {
  // Only handle plain paths (no query already stripped by caller).
  const decoded = decodeURIComponent(urlPath);
  // '/index.html' -> 'index.html'; '/../x' -> '../x' (still contains ..)
  const rel = decoded.replace(/^\/+/, "");
  const candidate = resolve(rootDir, rel);
  const root = resolve(rootDir);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null; // escape attempted
  }
  return candidate;
}

/** Start a preview server rooted at `rootDir`. */
export async function startPreviewServer(
  rootDir: string,
  options: PreviewServerOptions = {}
): Promise<PreviewServer> {
  const host = options.host ?? "127.0.0.1";
  const resolvedRoot = resolve(rootDir);

  const server: Server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? host}`);
    let filePath: string | null;
    try {
      filePath = resolveSafe(resolvedRoot, url.pathname);
    } catch {
      filePath = null; // decode errors etc. -> 400
    }

    if (!filePath) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Bad Request");
      return;
    }

    try {
      // Prevent serving directories themselves (allow implicit index.html).
      let target = filePath;
      const fileStat = await stat(target).catch(() => null);
      if (fileStat?.isDirectory()) {
        target = join(filePath, "index.html");
      }
      const body = await readFile(target);
      res.writeHead(200, {
        "Content-Type": MIME[extname(target)] ?? "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(options.port ?? 0, host, () => {
      server.removeListener("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Preview server failed to obtain a bound address");
  }
  const port = address.port;

  return {
    url: `http://${host}:${port}/`,
    port,
    stop() {
      return new Promise<void>((resolveStop) => {
        server.close(() => resolveStop());
      });
    },
  };
}
