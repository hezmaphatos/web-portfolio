/**
 * May another site be shown inside an <iframe> on this one? Judged from the two response
 * headers browsers enforce (spec §6.3 Live preview: "many sites block iframes via
 * X-Frame-Options / frame-ancestors"). Pure, so it is unit-tested (framing.test.ts).
 *
 * Why not just wait for the iframe's `load` event: a page refused by these headers still fires
 * `load` (the browser loads its own error page into the frame), so only the headers tell.
 */

export type FrameVerdict = "allowed" | "blocked";

export type FrameHeaders = {
  /** `X-Frame-Options` (may hold several comma-separated values). */
  xFrameOptions: string | null;
  /** `Content-Security-Policy` (several policies are joined by ", " when the header repeats). */
  contentSecurityPolicy: string | null;
};

const DEFAULT_PORT: Record<string, string> = { "http:": "80", "https:": "443" };

function portOf(url: URL): string {
  return url.port || DEFAULT_PORT[url.protocol] || "";
}

/** One CSP source expression (`'self'`, `*`, `https:`, `*.example.com`, `https://a.b:8080`). */
function sourceMatches(source: string, ancestor: URL, target: URL): boolean {
  const value = source.toLowerCase();
  if (value === "*") return ancestor.protocol === "http:" || ancestor.protocol === "https:";
  if (value === "'self'") return ancestor.origin === target.origin;
  if (value.startsWith("'")) return false; // 'none' and keyword sources that never match a page

  // Scheme source: "https:" (an http: source also allows its https: upgrade).
  if (/^[a-z][a-z0-9+.-]*:$/.test(value)) {
    return value === ancestor.protocol || (value === "http:" && ancestor.protocol === "https:");
  }

  // Host source: [scheme://]host[:port][/path] — the path is ignored for frame-ancestors.
  const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+|\*)(?::(\d+|\*))?/.exec(value);
  if (!match) return false;
  const [, scheme, wildcard, host, port] = match;
  if (scheme) {
    const allowed =
      `${scheme}:` === ancestor.protocol || (scheme === "http" && ancestor.protocol === "https:");
    if (!allowed) return false;
  } else if (ancestor.protocol !== "http:" && ancestor.protocol !== "https:") {
    return false;
  }
  const hostname = ancestor.hostname.toLowerCase();
  if (host !== "*") {
    if (wildcard) {
      if (!hostname.endsWith(`.${host}`)) return false;
    } else if (hostname !== host) {
      return false;
    }
  }
  if (port === "*") return true;
  if (port) return port === portOf(ancestor);
  // No port: the scheme's default port only.
  return !ancestor.port || ancestor.port === DEFAULT_PORT[ancestor.protocol];
}

/** The `frame-ancestors` source lists of every policy that has one (empty: no such directive). */
function frameAncestors(csp: string | null): string[][] {
  if (!csp) return [];
  const lists: string[][] = [];
  for (const policy of csp.split(",")) {
    for (const directive of policy.split(";")) {
      const [name, ...sources] = directive.trim().split(/\s+/);
      if (name?.toLowerCase() === "frame-ancestors") lists.push(sources.filter(Boolean));
    }
  }
  return lists;
}

/**
 * Whether `target` (the framed page, after redirects) may be framed by a page on `ancestor`.
 * `frame-ancestors` wins over `X-Frame-Options` when present (CSP Level 2); every policy must
 * allow the ancestor. X-Frame-Options: DENY blocks, SAMEORIGIN blocks other origins, the
 * obsolete ALLOW-FROM is ignored by current browsers (so it does not block).
 */
export function frameVerdict(headers: FrameHeaders, target: URL, ancestor: URL): FrameVerdict {
  const policies = frameAncestors(headers.contentSecurityPolicy);
  if (policies.length > 0) {
    const allowed = policies.every((sources) =>
      sources.some((source) => sourceMatches(source, ancestor, target)),
    );
    return allowed ? "allowed" : "blocked";
  }

  const options = (headers.xFrameOptions ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (options.includes("deny")) return "blocked";
  if (options.includes("sameorigin") && ancestor.origin !== target.origin) return "blocked";
  return "allowed";
}
