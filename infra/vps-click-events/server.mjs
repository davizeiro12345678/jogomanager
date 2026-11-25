import { createServer } from "node:http";
import { createConnection } from "node:net";
import { timingSafeEqual } from "node:crypto";

const TOKEN = process.env.CACHE_EVENTS_TOKEN ?? "";
if (!/^[0-9a-f]{64}$/.test(TOKEN)) throw new Error("invalid_ingest_token");
const EVENTS = new Set([
  "open_club",
  "open_market",
  "open_career",
  "start_match",
  "open_dashboard",
]);
const counters = { accepted: 0, rejected: 0, redisErrors: 0, rateLimited: 0 };
let inflight = 0;
let tokens = 400;
let refillAt = Date.now();
function allow() {
  const now = Date.now();
  tokens = Math.min(400, tokens + ((now - refillAt) * 200) / 1000);
  refillAt = now;
  if (tokens < 1) return false;
  tokens -= 1;
  return true;
}
function reply(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
}
function authed(req) {
  const value = req.headers["x-pfm-event-token"];
  return (
    typeof value === "string" &&
    /^[a-f0-9]{64}$/.test(value) &&
    timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(TOKEN, "hex"))
  );
}
function redisRequest(args) {
  const request =
    "*" +
    args.length +
    "\r\n" +
    args
      .map((x) => {
        const s = String(x);
        return "$" + Buffer.byteLength(s) + "\r\n" + s + "\r\n";
      })
      .join("");
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "pfm-click-events-redis", port: 6379 });
    let complete = false;
    let received = Buffer.alloc(0);
    const done = (error, value) => {
      if (complete) return;
      complete = true;
      socket.destroy();
      error ? reject(error) : resolve(value);
    };
    socket.setTimeout(1100, () => done(new Error("redis_timeout")));
    socket.on("error", (err) => done(err));
    socket.on("close", () => {
      if (!complete) done(new Error("redis_closed"));
    });
    socket.on("connect", () => socket.write(request));
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (received.length > 1024) return done(new Error("redis_reply_too_large"));
      const end = received.indexOf("\r\n");
      if (end < 0) return;
      const header = received.subarray(0, end).toString("utf8");
      if (header.startsWith("-")) return done(new Error("redis_error"));
      if (header.startsWith("+") || header.startsWith(":")) return done(null, header.slice(1));
      if (!header.startsWith("$")) return done(new Error("redis_protocol"));
      const bytes = Number(header.slice(1));
      if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 512)
        return done(new Error("redis_invalid_bulk"));
      if (received.length >= end + 2 + bytes + 2)
        done(null, received.subarray(end + 2, end + 2 + bytes).toString("utf8"));
    });
  });
}
async function readJson(req) {
  let size = 0;
  const blocks = [];
  for await (const block of req) {
    size += block.length;
    if (size > 256) throw new Error("too_large");
    blocks.push(block);
  }
  return JSON.parse(Buffer.concat(blocks).toString("utf8"));
}
const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    try {
      const ping = await redisRequest(["PING"]);
      return reply(res, ping === "PONG" ? 200 : 503, { healthy: ping === "PONG" });
    } catch {
      return reply(res, 503, { healthy: false });
    }
  }
  if (req.method === "GET" && req.url === "/metrics") {
    if (!authed(req)) return reply(res, 401, { error: "unauthorized" });
    return reply(res, 200, { ...counters, inflight });
  }
  if (req.method !== "POST" || req.url !== "/v1/events/click")
    return reply(res, 404, { error: "not_found" });
  if (!authed(req)) {
    counters.rejected++;
    return reply(res, 401, { error: "unauthorized" });
  }
  if ((req.headers["content-type"] || "").split(";")[0] !== "application/json") {
    counters.rejected++;
    return reply(res, 415, { error: "content_type" });
  }
  if (inflight >= 64 || !allow()) {
    counters.rateLimited++;
    return reply(res, 429, { error: "rate_limited" });
  }
  inflight++;
  try {
    let payload;
    try {
      payload = await readJson(req);
    } catch (error) {
      counters.rejected++;
      return reply(res, error.message === "too_large" ? 413 : 400, { error: "invalid_json" });
    }
    if (
      payload === null ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      payload.consent !== true ||
      !EVENTS.has(payload.event) ||
      Object.keys(payload).sort().join(",") !== "consent,event"
    ) {
      counters.rejected++;
      return reply(res, 400, { error: "invalid_event_or_consent" });
    }
    try {
      await redisRequest([
        "XADD",
        "pfm:events:clicks",
        "MAXLEN",
        "~",
        "10000",
        "*",
        "event",
        payload.event,
        "timestamp",
        String(Date.now()),
      ]);
      counters.accepted++;
      return reply(res, 202, { accepted: true });
    } catch {
      counters.redisErrors++;
      return reply(res, 503, { error: "event_queue_unavailable" });
    }
  } finally {
    inflight--;
  }
});
server.requestTimeout = 5000;
server.headersTimeout = 3000;
server.maxHeadersCount = 16;
server.listen(3095, "0.0.0.0", () => console.log("pfm_click_event_ingest_ready"));
process.on("SIGTERM", () => server.close());
