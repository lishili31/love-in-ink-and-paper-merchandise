// Secret scrubbing, shared by both log sinks.
//
// It lives in its own module because BOTH halves of app.log need it: the browser
// sink (clientlog.ts) and the server logger (logger.ts). The browser side has
// always scrubbed, so a doc claim like "secrets are redacted before they are
// written" held for browser lines and silently did NOT hold for server lines —
// the caller most likely to pass a URL with a token is server code
// (`log.error(msg, { url })`), so the unprotected half was the one that mattered.
//
// What it catches: values under a key that names a credential, and
// `Bearer …` / `?token=…` inside any string (the leak usually hides in a URL
// where the enclosing key is innocuous). Depth is capped so a cyclic object
// cannot recurse forever.
const SECRET_KEY_RE =
  /(token|secret|password|passwd|api[-_]?key|authorization|cookie|session)/i;
const SECRET_QUERY_RE =
  /([?&](?:[^=&#\s]*?(?:token|secret|password|key|kpt|auth|session)[^=&#\s]*)=)[^&#\s]+/gi;
const BEARER_RE = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;

const SCRUB_MAX_DEPTH = 6;

export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value
      .replace(BEARER_RE, "$1<redacted>")
      .replace(SECRET_QUERY_RE, "$1<redacted>");
  }
  if (depth >= SCRUB_MAX_DEPTH || !value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => scrubValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // Key match applies at every level, not just the top one.
    out[k] = SECRET_KEY_RE.test(k) ? "<redacted>" : scrubValue(v, depth + 1);
  }
  return out;
}

// scrubCtx applies scrubValue and keeps the result an object (the callers spread
// it into a log record). A non-object input collapses to undefined.
export function scrubCtx(
  ctx: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const scrubbed = scrubValue(ctx, 0);
  return typeof scrubbed === "object" && scrubbed !== null && !Array.isArray(scrubbed)
    ? (scrubbed as Record<string, unknown>)
    : undefined;
}
