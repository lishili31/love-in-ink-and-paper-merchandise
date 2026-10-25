// Per-request correlation for the application log.
//
// Why this exists: app.log holds BOTH halves of a request — the server's
// `log.error(...)` and the browser's POSTed `log.error(...)` — and without a
// shared key the two lines cannot be lined up. Debugging a 500 then gives you
// the server stack without telling you which browser error belongs to it.
//
// How the id travels: the server mints it once per inbound request (a plain
// random UUID — there is no distributed trace here, just a correlation key),
// echoes it on the `X-Request-Id` response header, and stamps it on every server
// log line written while that request is in flight. The browser reads the header
// and attaches the same id to the lines it POSTs to /api/log. One request, one
// id, two sinks.
//
// Implementation note: the id lives in an AsyncLocalStorage rather than in the
// log call's own argument, so app code keeps calling `log.error(msg, ctx)` and
// the correlation is added for free. Node's ALS is the right primitive here —
// it survives `await` boundaries, so a handler that logs after an await still
// carries the id of the request that started it.
import { AsyncLocalStorage } from "async_hooks";

export const REQUEST_ID_HEADER = "x-request-id";

const storage = new AsyncLocalStorage<string>();

// runWithRequestId scopes `fn` to a request id. The Hono middleware wraps every
// request in this, so anything logged inside — including after awaits — picks
// the id up via currentRequestId().
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run(requestId, fn);
}

// currentRequestId returns the id of the request in flight, or undefined outside
// any request scope (startup logging, a timer callback, a client-log write).
export function currentRequestId(): string | undefined {
  return storage.getStore();
}
