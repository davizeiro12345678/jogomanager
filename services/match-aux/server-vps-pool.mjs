import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { MatchWorkerPool, PoolBusyError } from "./worker-pool.mjs";
import { verifyRequest } from "./signature.mjs";

const key = process.env.MATCH_AUX_SIGNING_KEY;
const host = process.env.MATCH_AUX_BIND ?? "127.0.0.1";
const port = Number(process.env.MATCH_AUX_PORT ?? 3219);
const dbPath = process.env.MATCH_AUX_DB_PATH ?? "/var/lib/jm-match-aux/jobs.sqlite";
const workers = Number(process.env.MATCH_AUX_POOL_WORKERS ?? "2");
const maxQueue = Number(process.env.MATCH_AUX_POOL_QUEUE ?? "8");
if (!key || key.length < 32) throw Error("invalid_match_aux_key");
if (host !== "127.0.0.1" || !Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("invalid_bind");
const pool = new MatchWorkerPool({ size: workers, maxQueue, timeoutMs: 18_000 });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=2000;");
db.exec(
  "CREATE TABLE IF NOT EXISTS replay_jobs (room_id TEXT PRIMARY KEY, digest TEXT NOT NULL," +
    " status TEXT NOT NULL CHECK(status IN ('running','finished','failed'))," +
    " result TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
);
const lookup = db.prepare("SELECT digest,status,result,created_at FROM replay_jobs WHERE room_id=?");
const claim = db.prepare(
  "INSERT INTO replay_jobs(room_id,digest,status,result,created_at,expires_at)" +
    " VALUES(?,?,'running',NULL,?,?)",
);
const clear = db.prepare("DELETE FROM replay_jobs WHERE room_id=? AND digest=?");
const expire = db.prepare("DELETE FROM replay_jobs WHERE expires_at<? AND status!='running'");
const finish = db.prepare(
  "UPDATE replay_jobs SET status='finished',result=? WHERE room_id=? AND digest=? AND status='running'",
);
const fail = db.prepare(
  "UPDATE replay_jobs SET status='failed' WHERE room_id=? AND digest=? AND status='running'",
);
const respond = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
const readBody = async (req, limit = 2048) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw Error("payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};
const parse = (input) => {
  const v = JSON.parse(input);
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).sort().join(",") !== "awayClub,homeClub,roomId,seed" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.roomId) ||
    !/^[a-zA-Z0-9_:-]{1,80}$/.test(v.homeClub) ||
    !/^[a-zA-Z0-9_:-]{1,80}$/.test(v.awayClub) ||
    typeof v.seed !== "string" ||
    v.seed.length < 16 ||
    v.seed.length > 128
  ) throw Error("invalid_body");
  return v;
};

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz")
    return respond(res, 200, {
      ok: true,
      busy: pool.activeCount >= pool.size,
      workers: pool.size,
      active: pool.activeCount,
      queued: pool.queuedCount,
    });
  if (req.method !== "POST" || req.url !== "/v1/simulate")
    return respond(res, 404, { error: "not_found" });
  let raw;
  try {
    raw = await readBody(req);
  } catch {
    return respond(res, 413, { error: "payload_too_large" });
  }
  if (!verifyRequest(req.headers["x-pfm-timestamp"] ?? "", raw, req.headers["x-pfm-signature"] ?? "", key))
    return respond(res, 401, { error: "unauthorized" });

  let job;
  try {
    job = parse(raw);
  } catch {
    return respond(res, 400, { error: "invalid_request" });
  }
  const digest = createHash("sha256")
    .update(JSON.stringify([job.roomId, job.homeClub, job.awayClub, job.seed]))
    .digest("hex");
  let claimed = false;
  try {
    expire.run(Date.now());
    const previous = lookup.get(job.roomId);
    if (previous) {
      if (previous.digest !== digest) return respond(res, 409, { error: "room_mismatch" });
      if (previous.status === "finished" && previous.result)
        return respond(res, 200, JSON.parse(previous.result));
      if (previous.status === "running" && Date.now() - previous.created_at < 120_000)
        return respond(res, 409, { error: "room_in_progress" });
      clear.run(job.roomId, digest);
    }
    if (pool.activeCount >= pool.size && pool.queuedCount >= pool.maxQueue)
      return respond(res, 429, { error: "server_busy" });
    const now = Date.now();
    claim.run(job.roomId, digest, now, now + 7 * 86400000);
    claimed = true;

    const result = await pool.run({
      homeClub: job.homeClub,
      awayClub: job.awayClub,
      seed: job.seed,
    });
    if (
      !Number.isInteger(result.hg) ||
      !Number.isInteger(result.ag) ||
      !Number.isInteger(result.minute) ||
      !Number.isInteger(result.steps)
    ) throw Error("invalid_result");

    if (finish.run(JSON.stringify(result), job.roomId, digest).changes !== 1)
      throw Error("lost_job");
    return respond(res, 200, result);
  } catch (error) {
    if (claimed) {
      try {
        fail.run(job.roomId, digest);
      } catch {
        // A subsequent retry can reclaim failed claims.
      }
    }
    if (error instanceof PoolBusyError) return respond(res, 429, { error: "server_busy" });
    return respond(res, 503, { error: "simulation_unavailable" });
  }
});
server.requestTimeout = 24_000;
server.headersTimeout = 12_000;
server.keepAliveTimeout = 4_000;
server.maxRequestsPerSocket = 100;
server.listen(port, host, () => console.log("match_aux_pool_loopback_ready", port));
process.on("SIGTERM", () => {
  server.close(async () => {
    await pool.close();
    db.close();
    process.exit(0);
  });
});
