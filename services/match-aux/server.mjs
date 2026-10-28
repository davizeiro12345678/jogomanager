import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import { simulateAuthoritativeRoom } from "./engine.mjs";
import { verifyRequest } from "./signature.mjs";
import { completeMatchJob, failMatchJob } from "./job-store.mjs";

const port = Number(process.env.MATCH_AUX_PORT ?? 3090);
const host = process.env.MATCH_AUX_BIND ?? "127.0.0.1";
const key = process.env.MATCH_AUX_SIGNING_KEY;
const mongoUri = process.env.MONGODB_URI;
if (!key || key.length < 32 || !mongoUri?.startsWith("mongodb+srv://")) {
  throw new Error("MATCH_AUX_SIGNING_KEY and MONGODB_URI required");
}
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("invalid_port");
const mongo = new MongoClient(mongoUri, {
  maxPoolSize: 2,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 3_000,
  connectTimeoutMS: 3_000,
  waitQueueTimeoutMS: 2_000,
  appName: "pfm-match-aux",
});
await mongo.connect();
const jobs = mongo.db("jogomanager_aux").collection("game_jobs");
await jobs.createIndex({ roomId: 1 }, { unique: true, name: "unique_room_id" });
await jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_match_jobs" });

let busy = false;
const readBody = async (req, limit = 2048) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};
const write = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(data));
};
const parse = (body) => {
  const data = JSON.parse(body);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_body");
  if (
    Object.keys(data).sort().join(",") !== "awayClub,homeClub,roomId,seed" ||
    !/^[0-9a-f-]{36}$/i.test(data.roomId) ||
    !/^[a-zA-Z0-9_:-]{1,80}$/.test(data.homeClub) ||
    !/^[a-zA-Z0-9_:-]{1,80}$/.test(data.awayClub) ||
    typeof data.seed !== "string" ||
    data.seed.length < 16 ||
    data.seed.length > 128
  ) {
    throw new Error("invalid_body");
  }
  return data;
};

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    return write(res, 200, { ok: true, busy }); // no secrets or databases exposed
  }
  if (req.method !== "POST" || req.url !== "/v1/simulate") {
    return write(res, 404, { error: "not_found" });
  }
  let body;
  try {
    body = await readBody(req);
  } catch {
    return write(res, 413, { error: "payload_too_large" });
  }
  if (
    !verifyRequest(
      req.headers["x-pfm-timestamp"] ?? "",
      body,
      req.headers["x-pfm-signature"] ?? "",
      key,
    )
  ) {
    return write(res, 401, { error: "unauthorized" });
  }
  let data;
  try {
    data = parse(body);
  } catch {
    return write(res, 400, { error: "invalid_request" });
  }
  const digest = createHash("sha256")
    .update(JSON.stringify([data.roomId, data.homeClub, data.awayClub, data.seed]))
    .digest("hex");
  let claimId;
  let slotAcquired = false;
  try {
    const previous = await jobs.findOne({ roomId: data.roomId });
    if (previous) {
      if (previous.digest !== digest) return write(res, 409, { error: "room_mismatch" });
      if (previous.status === "finished" && previous.result) {
        return write(res, 200, previous.result);
      }
      const elapsed = Date.now() - new Date(previous.createdAt).getTime();
      // A process can crash mid-match. Reclaim only failed or stale
      // sessions without invalidating a still-running simulation.
      if (previous.status !== "failed" && !(previous.status === "running" && elapsed > 120_000))
        return write(res, 409, { error: "room_in_progress" });
      if (previous.status === "running" && busy) {
        return write(res, 409, { error: "room_in_progress" });
      }
      const released = await jobs.deleteOne({
        _id: previous._id,
        digest,
        status: previous.status,
      });
      if (released.deletedCount !== 1) {
        return write(res, 409, { error: "room_in_progress" });
      }
    }
    if (busy) return write(res, 429, { error: "server_busy" });
    busy = true;
    slotAcquired = true;
    // Unique index prevents conflicting claims across multiple processes.
    const claim = await jobs.insertOne({
      roomId: data.roomId,
      digest,
      status: "running",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    claimId = claim.insertedId;
    const started = performance.now();
    const result = await simulateAuthoritativeRoom(data.homeClub, data.awayClub, data.seed);
    const durationMs = Math.round(performance.now() - started);
    await completeMatchJob(jobs, claimId, digest, result, durationMs);
    return write(res, 200, result);
  } catch {
    if (claimId) {
      await failMatchJob(jobs, claimId, digest).catch(() => undefined);
    }
    return write(res, 503, { error: "simulation_unavailable" });
  } finally {
    if (slotAcquired) busy = false;
  }
});
server.requestTimeout = 25_000;
server.headersTimeout = 10_000;
server.listen(port, host, () => {
  console.log("match aux listening on loopback", port);
});
const shutdown = async () => {
  server.close();
  await mongo.close();
};
process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
