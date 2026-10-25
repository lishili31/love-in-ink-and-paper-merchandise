// Frontend logger. Browser-side errors are POSTed to /api/log, where the server
// appends them to the same JSONL file the backend writes. One file, both halves.
//
// Same-origin by construction: the page and /api/log are served by the same
// server, so the path needs no host config. When the endpoint is absent (for
// example a pure-frontend build) the POST fails and we silently fall back to
// console — logging must never break the app.
type Level = "info" | "warn" | "error";

const ENDPOINT = `${import.meta.env.BASE_URL}api/log`;
// Coalesce bursts: errors during a render storm would otherwise fire one POST
// each. Flush on a microtask so ordering is preserved.
let queue: Array<{ level: Level; msg: string; ctx?: Record<string, unknown> }> =
  [];
let scheduled = false;

// Bounded queue. An error storm can out-run the flush (a render loop throwing on
// every frame emits far faster than a microtask), and an unbounded array is an
// OOM in the very process the agent is trying to diagnose. Beyond the cap the
// OLDEST entries are dropped: the newest are the ones that reflect the state the
// agent will inspect, and keeping the first-N of an ever-growing burst would
// preserve only the least informative prefix.
const QUEUE_MAX = 500;
let dropped = 0;

// Chunks are capped at the server's per-request line limit (clientlog.ts
// LOG_MAX_LINES_PER_REQUEST) so no chunk can be rejected wholesale.
const SEND_MAX_LINES = 50;

// Correlation with the server's request id.
//
// The server stamps every response with X-Request-Id (see
// api/lib/requestcontext.ts). Browser errors are emitted *after* the failing
// call — usually from a catch that runs once the response has already arrived —
// so the id available at emit time is the id of the request that just failed.
//
// The trap is concurrency: with several requests in flight, "the last response
// to arrive" is not necessarily the one that failed, and stamping it would
// attach a confidently wrong id to the line. So ids are kept in a short window
// and only used when exactly one candidate exists; an ambiguous emit is left
// unstamped rather than mislabelled.
const CORRELATION_WINDOW_MS = 2000;
let recentIds: Array<{ id: string; at: number }> = [];

function rememberRequestId(id: string): void {
  const now = Date.now();
  recentIds.push({ id, at: now });
  recentIds = recentIds.filter(e => now - e.at <= CORRELATION_WINDOW_MS);
}

// unambiguousRequestId returns the single recent id, or undefined when zero or
// several are in play (an ambiguous correlation is worse than none).
function unambiguousRequestId(): string | undefined {
  const now = Date.now();
  recentIds = recentIds.filter(e => now - e.at <= CORRELATION_WINDOW_MS);
  const distinct = new Set(recentIds.map(e => e.id));
  return distinct.size === 1 ? recentIds[recentIds.length - 1].id : undefined;
}

// Record each response's request id. Done by wrapping fetch once, at module
// load, rather than at each call site: the injected frontend uses plain fetch /
// tRPC / react-query, and none of them would thread a header read through by
// hand.
if (typeof window !== "undefined" && typeof window.fetch === "function") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    try {
      const id = response.headers.get("x-request-id");
      if (id) rememberRequestId(id);
    } catch {
      // An opaque/error response with unreadable headers is not a reason to
      // lose the response itself.
    }
    return response;
  };
}

function flush(): void {
  scheduled = false;
  const batch = queue;
  queue = [];
  if (batch.length === 0 && dropped === 0) return;
  // Surface the drop count as its own line: a truncated storm must not read
  // like a complete one.
  if (dropped > 0) {
    batch.push({
      level: "warn",
      msg: "client log queue overflowed; oldest entries dropped",
      ctx: { dropped },
    });
    dropped = 0;
  }
  const requestId = unambiguousRequestId();
  const stamped = requestId
    ? batch.map(item => ({
        ...item,
        ctx: { requestId, ...item.ctx },
      }))
    : batch;
  // Chunk the send. The server accepts at most LOG_MAX_LINES_PER_REQUEST (50)
  // per POST and rejects an over-64KB body with 413, dropping the whole batch.
  // Sending the queue as one body therefore lost the entire burst exactly when
  // it mattered most — an error storm is the case this feature exists for, and
  // the lines at the tail are usually the ones that explain it. Splitting keeps
  // every line eligible; a rejected chunk cannot take the others down with it.
  for (let i = 0; i < stamped.length; i += SEND_MAX_LINES) {
    send(stamped.slice(i, i + SEND_MAX_LINES));
  }
}

function send(chunk: Array<{ level: Level; msg: string; ctx?: Record<string, unknown> }>): void {
  try {
    // sendBeacon survives page unload (the common case for a crash); fall back
    // to fetch where it is unavailable.
    const body = JSON.stringify(chunk);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "application/json" })
      );
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never surface a logging failure to the app.
  }
}

function emit(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  if (level === "error") console.error(msg, ctx ?? "");
  else if (level === "warn") console.warn(msg, ctx ?? "");
  else console.log(msg, ctx ?? "");

  if (queue.length >= QUEUE_MAX) {
    // Drop the oldest and count it, so the loss is visible in the log itself
    // rather than being silent (a storm that silently truncates reads exactly
    // like a storm that never happened).
    queue.shift();
    dropped += 1;
  }
  queue.push({ level, msg, ctx });
  if (!scheduled) {
    scheduled = true;
    // queueMicrotask keeps ordering while still batching a synchronous burst.
    queueMicrotask(flush);
  }
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    emit("error", msg, ctx),
};

// Capture the crashes a try/catch cannot: unhandled errors and rejections are
// exactly what the agent needs to see when a preview comes up blank.
if (typeof window !== "undefined") {
  window.addEventListener("error", e => {
    emit("error", e.message || "window.onerror", {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", e => {
    const reason = e.reason;
    emit("error", "unhandledrejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

export default log;
