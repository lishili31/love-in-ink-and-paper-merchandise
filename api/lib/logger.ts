// Structured logger for the backend, mirrored to a local JSONL file.
//
// Every line is written to stdout and appended to the log file from one call, so
// both sinks carry the same bytes. The file is useful when stdout is collected
// elsewhere (PM2, a container log driver) and you want a single local trail.
//
// Zero dependencies on purpose: pulling in pino/winston would add weight for a
// feature whose whole job is "append one JSON line".
import fs from "fs";
import path from "path";
import { currentRequestId } from "./requestcontext";
import { scrubCtx, scrubValue } from "./scrub";

// Fixed path (not PID-suffixed) so the location is predictable. The directory is
// configurable and defaults to ./logs inside the project; it is gitignored.
//
// It is NOT "naturally bounded": the rate limits in clientlog.ts cap the
// *browser* path per minute, but server lines, access-log lines and static-asset
// requests are not rate limited at all, so a busy instance can write gigabytes
// over a long session and fill the disk. Hence an explicit byte budget below:
// past it the file is truncated once, with a marker, so the newest evidence
// survives and the total stays bounded.
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), "logs");
const LOG_FILE = process.env.LOG_FILE ?? path.join(LOG_DIR, "app.log");
// 8 MiB is far more than a debugging session reads and small enough that even a
// hostile write rate cannot exhaust the disk.
const LOG_MAX_BYTES = 8 * 1024 * 1024;

let bytesWritten = 0;
let sizeKnown = false;

// enforceBudget truncates the file once it exceeds LOG_MAX_BYTES. Doing it here
// (on the write path) rather than with a timer keeps the bound independent of
// whether anything else in the process is still alive — the failure mode being
// guarded is a runaway writer, which by definition keeps calling in.
function enforceBudget(lineLength: number): void {
  if (!sizeKnown) {
    try {
      bytesWritten = fs.statSync(LOG_FILE).size;
    } catch {
      bytesWritten = 0;
    }
    sizeKnown = true;
  }
  if (bytesWritten + lineLength <= LOG_MAX_BYTES) return;
  try {
    fs.writeFileSync(
      LOG_FILE,
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        msg: "app.log exceeded its size budget; truncated",
        maxBytes: LOG_MAX_BYTES,
      }) + "\n"
    );
  } catch {
    // If we cannot truncate, keep appending: losing old lines is better than
    // losing the process's ability to log at all.
    return;
  }
  bytesWritten = 0;
}

let dirReady = false;
function ensureDir(): void {
  if (dirReady) return;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    dirReady = true;
  } catch {
    // A read-only or missing /tmp must not crash the app; stdout still works.
  }
}

type Level = "debug" | "info" | "warn" | "error";

// Reserved fields the caller must not be able to override from ctx — same gate
// clientlog.ts applies to browser-supplied context. Without it, a ctx carrying
// `level`/`msg`/`ts` would rewrite the line's own identity (and could relabel a
// `warn` as `error`, or forge a timestamp).
const RESERVED_KEYS = new Set(["ts", "level", "msg", "requestId"]);

function write(level: Level, msg: string, ctx?: Record<string, unknown>): void {
  // Serialization is inside the try: a cyclic or BigInt-bearing ctx throws, and
  // logging must never take a request down with it (the file sink below is
  // explicitly best-effort for the same reason).
  let line: string;
  try {
    // The request id is added here rather than at each call site: app code keeps
    // calling log.error(msg, ctx) and the correlation comes for free. It is
    // spread FIRST so an explicit ctx.requestId still wins.
    const requestId = currentRequestId();
    const extra = Object.fromEntries(
      Object.entries(scrubCtx(ctx) ?? {}).filter(([k]) => !RESERVED_KEYS.has(k))
    );
    line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ...(requestId ? { requestId } : {}),
      // The message is scrubbed too: secrets frequently arrive inside it (a URL
      // with a query token), not only in ctx.
      msg: scrubValue(msg),
      ...extra,
    });
  } catch {
    return;
  }
  // stdout first: if the file append throws, the message is not lost.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  // debug and info both go to stdout via console.log: the log file is what
  // distinguishes them (the `level` field), and console.debug is a no-op under
  // some defaults, which would drop the line from stdout too.
  else console.log(line);

  ensureDir();
  try {
    enforceBudget(line.length + 1);
    fs.appendFileSync(LOG_FILE, line + "\n");
    bytesWritten += line.length + 1;
  } catch {
    // Best-effort sink; never let logging break a request.
  }
}

// appendLine is the sink the client-log endpoint writes through, so browser
// logs land in exactly the same file with the same shape as server logs.
//
// It also echoes to stdout, for the same reason write() does: the platform log
// pipeline collects stdout, so a file-only browser line vanished as soon as the
// instance was replaced. Server lines already had both sinks; browser lines
// having only the file was an inconsistency, not a design choice.
export function appendLine(line: string): void {
  try {
    console.log(line);
  } catch {
    // stdout is best-effort too.
  }
  ensureDir();
  try {
    enforceBudget(line.length + 1);
    fs.appendFileSync(LOG_FILE, line + "\n");
    bytesWritten += line.length + 1;
  } catch {
    // Best-effort.
  }
}

export const log = {
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    write("error", msg, ctx),
  // debug exists so app code has a file-backed level below info. Without it the
  // natural fallback is console.debug, which some runtimes suppress — so
  // "verbose logging in the app" would silently disappear.
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
};

export const logFilePath = LOG_FILE;
