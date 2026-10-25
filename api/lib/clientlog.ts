// Client-log sink: the browser half of the unified log.
//
// Browsers cannot write to the server's filesystem, so the frontend logger POSTs
// here and we append the lines to the same JSONL file the backend writes — one
// file, one format, one place to look.
//
// Guardrails (the preview URL is public — anyone holding it can reach this
// route, so treat every field as untrusted):
//   - cap each field (LOG_VALUE_MAX, applied before serialization so the line
//     stays valid JSON) and each request body (LOG_BODY_MAX);
//   - cap writes per window so a hostile caller cannot fill the disk: a
//     per-identity cap plus a global ceiling, because the identity comes from a
//     client-supplied header and is therefore rotatable;
//   - never echo anything back (a log endpoint is not a reflection surface).
import type { Context } from "hono";
import { appendLine } from "./logger";
import { scrubCtx, scrubValue } from "./scrub";

const LOG_BODY_MAX = 64 * 1024;
const LOG_MAX_LINES_PER_REQUEST = 50;
// Token-bucket-ish guard: at most this many lines accepted per client window.
const LOG_MAX_LINES_PER_MINUTE = 600;
// Global budget: the per-key limit above is keyed on a client-supplied header
// (see clientKey), so a caller rotating X-Forwarded-For would otherwise get a
// fresh window per request and the cap would never bite. This ceiling is what
// actually makes "a hostile caller cannot fill the disk" true; it is reset
// every window regardless of how many distinct keys appear.
const LOG_MAX_LINES_PER_MINUTE_GLOBAL = 3000;
// Upper bound on tracked keys, so rotating identities cannot grow the map
// without limit (an unbounded map here is an OOM on the preview process).
const WINDOW_MAX_KEYS = 1024;

const WINDOW_MS = 60_000;

type ClientLine = {
  level?: string;
  msg?: string;
  ctx?: Record<string, unknown>;
};

type Window = { at: number; count: number };

const windowStart = new Map<string, Window>();
let globalWindow: Window = { at: 0, count: 0 };

// evictStale drops windows that have aged out. Called before inserting a new
// key so the map stays bounded even when the caller never repeats a key.
function evictStale(now: number): void {
  if (windowStart.size < WINDOW_MAX_KEYS) return;
  for (const [k, v] of windowStart) {
    if (now - v.at > WINDOW_MS) windowStart.delete(k);
  }
  // Still full of live windows: drop oldest insertions (Map preserves order).
  while (windowStart.size >= WINDOW_MAX_KEYS) {
    const oldest = windowStart.keys().next();
    if (oldest.done) break;
    windowStart.delete(oldest.value);
  }
}

// underRateLimit charges one line against both the per-key and the global
// window. Either one being exhausted rejects the line.
function underRateLimit(key: string): boolean {
  const now = Date.now();

  if (now - globalWindow.at > WINDOW_MS) globalWindow = { at: now, count: 0 };
  if (globalWindow.count >= LOG_MAX_LINES_PER_MINUTE_GLOBAL) return false;

  const cur = windowStart.get(key);
  if (!cur || now - cur.at > WINDOW_MS) {
    evictStale(now);
    windowStart.set(key, { at: now, count: 1 });
    globalWindow.count += 1;
    return true;
  }
  if (cur.count >= LOG_MAX_LINES_PER_MINUTE) return false;
  cur.count += 1;
  globalWindow.count += 1;
  return true;
}

// Truncation must happen on VALUES, not on the serialized line.
//
// The earlier version sliced the finished JSON at a byte limit and appended a
// marker. That cuts inside a string literal, so the line stops being
// JSON: a long stack (exactly the case worth reading) produced
// `Unterminated string in JSON at position N` and every downstream consumer that
// parses app.log dropped the line. Budgeting the fields first keeps each line
// valid JSON — oversized values are shortened, the record survives.
const LOG_VALUE_MAX = 1024;

function clampValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > LOG_VALUE_MAX
      ? value.slice(0, LOG_VALUE_MAX) + "…[truncated]"
      : value;
  }
  return value;
}

// clampRecord shortens every field (and nested ctx field) so the serialized line
// fits. It works on the record, never on the encoded form.
function clampRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = clampValue(v);
  }
  return out;
}

// Reserved log fields. Kept in one place so the writer and the filter cannot
// drift apart.
const RESERVED_KEYS = new Set(["ts", "source", "level", "msg"]);

// reservedFiltered returns ctx minus the reserved keys, so spreading it cannot
// override the line's own ts/source/level/msg.
function reservedFiltered(
  ctx: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!ctx) return {};
  return Object.fromEntries(
    Object.entries(ctx).filter(([k]) => !RESERVED_KEYS.has(k))
  );
}

export async function handleClientLog(c: Context): Promise<Response> {
  const declared = Number(c.req.header("content-length") ?? "0");
  if (declared > LOG_BODY_MAX) return c.body(null, 413);

  let payload: unknown;
  try {
    const raw = await c.req.text();
    if (raw.length > LOG_BODY_MAX) return c.body(null, 413);
    payload = JSON.parse(raw);
  } catch {
    return c.body(null, 400);
  }

  const incoming: ClientLine[] = Array.isArray(payload)
    ? (payload as ClientLine[])
    : [payload as ClientLine];
  if (incoming.length > LOG_MAX_LINES_PER_REQUEST) {
    incoming.length = LOG_MAX_LINES_PER_REQUEST;
  }

  // Identity for the rate limit: cf-connecting-ip first, then the forwarded
  // chain. Absent headers collapse to "anon" — a weak key, but the line cap
  // still bounds damage.
  const clientKey =
    c.req.header("cf-connecting-ip") ??
    (c.req.header("x-forwarded-for") ?? "anon").split(",")[0].trim();

  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    if (!underRateLimit(clientKey)) break;
    const level =
      typeof item.level === "string" ? item.level.slice(0, 16) : "info";
    const msg = typeof item.msg === "string" ? item.msg : "";
    const ctx = scrubCtx(item.ctx);
    // Reserved keys (ts/source/level/msg) are written first and filtered out of
    // ctx: a caller passing { level: "info" } or { source: "server" } must not
    // be able to relabel the line or forge its origin — the keyword map in the
    // building skill keys off `source`.
    const line = JSON.stringify(
      clampRecord({
        ts: new Date().toISOString(),
        source: "client",
        level,
        msg: scrubValue(msg),
        ...reservedFiltered(ctx),
      })
    );
    appendLine(line);
  }

  // No body: this is a sink, not a resource.
  return c.body(null, 204);
}
