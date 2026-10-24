import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://jogomanager.com";
const port = Number(process.env.PORT || "8080");
const workerLimit = Math.max(1, Math.min(4, Number(process.env.MATCH_CONCURRENCY || "1")));
const previewEnabled = process.env.ENABLE_MATCH_PREVIEW === "true";
const timeWindow = new Map();
let activeWorkers = 0;

function respond(res, status, value, origin) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    vary: "Origin",
    ...(origin === allowedOrigin ? { "access-control-allow-origin": origin } : {}),
  });
  res.end(JSON.stringify(value));
}

function rateLimited(token) {
  const now = Date.now();
  if (timeWindow.size > 10000) {
    for (const [hash, entry] of timeWindow) {
      if (entry.expires <= now) timeWindow.delete(hash);
    }
  }
  const hash = createHash("sha256").update(token).digest("hex");
  const entry = timeWindow.get(hash);
  if (!entry || entry.expires <= now) {
    timeWindow.set(hash, { count: 1, expires: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > 30;
}

function getToken(req) {
  const match = /^Bearer ([A-Za-z0-9_+.-]{10,8192})$/.exec(req.headers.authorization || "");
  return match?.[1] || null;
}

function sbUrl(path) {
  const origin = new URL(supabaseUrl);
  const dest = new URL(path, origin);
  if (dest.origin !== origin.origin) throw new Error("invalid_supabase_origin");
  return dest;
}

async function sbFetch(path, token) {
  return fetch(sbUrl(path), {
    headers: {
      apikey: publishableKey,
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
}

async function verifiedUser(token) {
  const response = await sbFetch("/auth/v1/user", token);
  if (!response.ok) return null;
  const user = await response.json();
  if (!user || typeof user.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
    return null;
  }
  return { id: user.id, token };
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function runPreview(homeClub, awayClub) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./match-worker.mjs", import.meta.url), {
      workerData: { homeClub, awayClub, seed: randomUUID() },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    let finished = false;
    const timer = setTimeout(() => done(new Error("simulation_timeout")), 20000);
    function done(err, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (err) reject(err);
      else resolve(value);
    }
    worker.once("message", msg => {
      if (msg?.ok && Number.isInteger(msg.homeGoals) && Number.isInteger(msg.awayGoals)) {
        done(null, msg);
      } else done(new Error("simulation_failed"));
    });
    worker.once("error", err => done(err));
    worker.once("exit", code => { if (!finished) done(new Error("worker_exit_" + code)); });
  });
}

export function createAuxServer() {
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    try {
      if (req.method === "OPTIONS") {
        if (origin !== allowedOrigin) return respond(res, 403, { error: "origin_denied" }, origin);
        res.writeHead(204, {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-max-age": "600",
          vary: "Origin",
        });
        return res.end();
      }
      const path = new URL(req.url || "/", "http://127.0.0.1");
      if (path.pathname === "/healthz" && req.method === "GET") {
        return respond(res, 200, { ok: true, service: "jogomanager-aux", version: 1 }, origin);
      }
      if (!supabaseUrl?.startsWith("https://") || !publishableKey ||
          !Number.isInteger(port) || port < 1 || port > 65535) {
        return respond(res, 503, { error: "not_configured" }, origin);
      }
      if (path.pathname === "/readyz" && req.method === "GET") {
        const ready = (await sbFetch("/auth/v1/settings")).ok;
        return respond(res, ready ? 200 : 503, { ready }, origin);
      }
      if (!["/v1/auth/me", "/v1/purchases/status", "/v1/matches/preview"].includes(path.pathname)) {
        return respond(res, 404, { error: "not_found" }, origin);
      }
      if (req.method !== (path.pathname === "/v1/matches/preview" ? "POST" : "GET")) {
        return respond(res, 405, { error: "method_not_allowed" }, origin);
      }
      const token = getToken(req);
      if (!token) return respond(res, 401, { error: "unauthorized" }, origin);
      if (rateLimited(token)) return respond(res, 429, { error: "rate_limited" }, origin);
      const user = await verifiedUser(token);
      if (!user) return respond(res, 401, { error: "unauthorized" }, origin);

      if (path.pathname === "/v1/auth/me") {
        return respond(res, 200, { userId: user.id }, origin);
      }
      if (path.pathname === "/v1/purchases/status") {
        const ref = path.searchParams.get("reference");
        if (!ref || !/^cs_[A-Za-z0-9_]{3,220}$/.test(ref)) {
          return respond(res, 400, { error: "invalid_reference" }, origin);
        }
        const query = new URLSearchParams({
          select: "status",
          user_id: "eq." + user.id,
          reference: "eq." + ref,
          limit: "1",
        });
        const upstream = await sbFetch("/rest/v1/user_purchases?" + query, user.token);
        if (!upstream.ok) {
          return respond(res, 503, { error: "purchase_lookup_unavailable" }, origin);
        }
        const purchases = await upstream.json();
        return respond(res, 200, {
          status: Array.isArray(purchases) && purchases[0]
            ? String(purchases[0].status) : "not_found",
        }, origin);
      }
      if (!previewEnabled) return respond(res, 503, { error: "preview_disabled" }, origin);
      if (activeWorkers >= workerLimit) return respond(res, 429, { error: "busy" }, origin);
      let input;
      try { input = await readBody(req); }
      catch { return respond(res, 400, { error: "invalid_body" }, origin); }
      if (!input || typeof input !== "object" ||
          typeof input.homeClub !== "string" || typeof input.awayClub !== "string" ||
          !/^[A-Za-z0-9_-]{1,80}$/.test(input.homeClub) ||
          !/^[A-Za-z0-9_-]{1,80}$/.test(input.awayClub)) {
        return respond(res, 400, { error: "invalid_club" }, origin);
      }
      activeWorkers++;
      try {
        const result = await runPreview(input.homeClub, input.awayClub);
        return respond(res, 200, {
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          unofficial: true,
        }, origin);
      } catch {
        return respond(res, 503, { error: "simulation_unavailable" }, origin);
      } finally { activeWorkers--; }
    } catch {
      respond(res, 503, { error: "dependency_unavailable" }, origin);
    }
  });
  server.keepAliveTimeout = 6000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  createAuxServer().listen(port, "0.0.0.0", () => {
    console.log("jogomanager-aux listening");
  });
}
