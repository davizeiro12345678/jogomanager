import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.JM_SUPABASE_BRIDGE_PORT || "3088");
const base = process.env.SUPABASE_URL;
const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!base || !apiKey) throw new Error("Missing Supabase configuration");
const url = new URL(base);
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
  throw new Error("Invalid Supabase URL");
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");

function respond(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(JSON.stringify(obj));
}

async function supabaseGet(path, bearer) {
  const headers = { apikey: apiKey, accept: "application/json" };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  return fetch(new URL(path, url), {
    method: "GET",
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    return respond(res, 200, { ok: true, service: "jogomanager-supabase-bridge" });
  }
  if (req.method === "GET" && req.url === "/readyz") {
    try {
      const upstream = await supabaseGet("/auth/v1/settings");
      await upstream.arrayBuffer();
      return respond(res, upstream.ok ? 200 : 503, {
        ready: upstream.ok,
        supabaseStatus: upstream.status,
      });
    } catch {
      return respond(res, 503, { ready: false, error: "supabase_unreachable" });
    }
  }
  if (req.method === "POST" && req.url === "/v1/verify-user") {
    const auth = req.headers.authorization;
    if (
      typeof auth !== "string" ||
      !/^Bearer [a-zA-Z0-9._~-]+$/.test(auth) ||
      auth.length > 4096
    ) {
      return respond(res, 401, { authenticated: false });
    }
    // The Supabase Auth server checks token signature, expiry and session status.
    // Never trust client-provided user IDs or user_metadata as authorization.
    try {
      const upstream = await supabaseGet("/auth/v1/user", auth.slice(7));
      if (!upstream.ok) {
        await upstream.arrayBuffer();
        return respond(res, 401, { authenticated: false });
      }
      const data = await upstream.json();
      if (!data || typeof data.id !== "string" || !/^[0-9a-f-]{36}$/i.test(data.id)) {
        return respond(res, 502, { error: "invalid_identity_response" });
      }
      return respond(res, 200, { authenticated: true, userId: data.id });
    } catch {
      return respond(res, 503, { error: "identity_provider_unavailable" });
    }
  }
  respond(res, 404, { error: "not_found" });
});
server.headersTimeout = 10_000;
server.requestTimeout = 10_000;
server.keepAliveTimeout = 2500;
server.maxRequestsPerSocket = 60;
server.listen(port, host, () => console.info(`Supabase bridge listening locally on ${host}:${port}`));
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
