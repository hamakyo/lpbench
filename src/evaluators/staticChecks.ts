/**
 * Deterministic static checks for a generated artifact.
 *
 * These checks run WITHOUT a browser and cover the machine-checkable parts of
 * instruction compliance and code-quality (docs/BENCHMARK_DESIGN.md). Browser
 * dependent checks (runtime errors, horizontal overflow, interaction) live in
 * the Playwright evaluator, not here.
 *
 * Output uses the p/f/u marks from docs/ARCHITECTURE.md:
 *   passed | failed | unknown | notEvaluated
 * and never fabricates a numeric score for something that was not measured.
 */

export type CheckStatus = "passed" | "failed" | "unknown" | "notEvaluated";

export interface CheckItem {
  /** Short stable key, e.g. "required-file:index.html". */
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface ExternalReference {
  url: string;
  /** Where it appeared, e.g. "script-src", "link-href", "css-url". */
  where: string;
}

/** Scheme-relative or absolute external URL matcher (https?:// or //). */
const EXTERNAL_URL = /(?:https?:)?\/\/[^\s"'<>()]+/g;

/** Check that every required artifact file is present. */
export function requiredFilesCheck(required: string[], presentFiles: string[]): CheckItem[] {
  const present = new Set(presentFiles);
  return required.map((file) => ({
    key: `required-file:${file}`,
    label: `Required file present: ${file}`,
    status: present.has(file) ? "passed" : "failed",
  }));
}

/**
 * Scan HTML for forbidden external references: script src, link href, img src
 * pointing off-origin, and inline https?:// URLs. Returns all matches.
 */
export function findHtmlExternalReferences(html: string): ExternalReference[] {
  const refs: ExternalReference[] = [];
  // <script src="...">, <link href="...">, <img src="...">, <a href="http...">
  const attrRe = /<(script|link|img|source|video|audio|iframe|a)\b[^>]*?\b(src|href)=["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) {
    const [, tag, attr, value] = m;
    // Reject absolute URLs and scheme-relative (//host) values.
    const isExternal = /^(?:https?:)?\/\//i.test(value) || /^(?:data|javascript):/i.test(value);
    if (isExternal) {
      refs.push({ url: value, where: `${tag}-${attr}` });
    }
  }
  return refs;
}

/** Scan CSS for external url(...) references. */
export function findCssExternalReferences(css: string): ExternalReference[] {
  const refs: ExternalReference[] = [];
  const urlRe = /url\((["']?)(.*?)\1\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(css)) !== null) {
    const value = m[2].trim();
    if (value === "") continue;
    const isExternal =
      /^(?:https?:)?\/\//i.test(value) || // absolute / scheme-relative
      /^data:/i.test(value) || // inline data (fonts/images) — external-ish asset
      /^\s*\/\//.test(value);
    if (isExternal) {
      refs.push({ url: value, where: "css-url" });
    }
  }
  return refs;
}

/**
 * Instruction-compliance check for forbidden external assets/libraries.
 * The benchmark forbids external JS/lib/assets/fonts, so any external
 * reference is an instruction-compliance failure.
 */
export function externalAssetCheck(html: string, css?: string): CheckItem {
  const htmlRefs = findHtmlExternalReferences(html);
  const cssRefs = css ? findCssExternalReferences(css) : [];
  const all = [...htmlRefs, ...cssRefs];
  return {
    key: "compliance:no-external-assets",
    label: "No external JS/libraries/fonts/assets",
    status: all.length === 0 ? "passed" : "failed",
    detail: all.length ? `Found ${all.length} external reference(s): ${all.slice(0, 5).map((r) => r.url).join(", ")}` : undefined,
  };
}

/** Check that required content/copy is present in the HTML. */
export function requiredContentCheck(html: string, requiredStrings: string[]): CheckItem[] {
  return requiredStrings.map((s) => ({
    key: `content:${s}`,
    label: `Required content present: ${s}`,
    status: html.includes(s) ? "passed" : "failed",
  }));
}

/** Basic document-structure sanity (html/head/body/viewport). */
export function documentStructureCheck(html: string): CheckItem[] {
  const checks: [string, string, RegExp][] = [
    ["document:<html>", "<html> tag", /<html[\s>]/i],
    ["document:<head>", "<head> tag", /<head[\s>]/i],
    ["document:<body>", "<body> tag", /<body[\s>]/i],
    ["document:viewport", "viewport meta", /<meta[^>]+name=["']viewport["']/i],
  ];
  return checks.map(([key, label, re]) => ({
    key,
    label,
    status: re.test(html) ? "passed" : "failed",
  }));
}
