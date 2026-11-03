import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { completeMatchJob, failMatchJob } from "./job-store.mjs";

// This suite must use an explicit disposable fixture, never the service URI.
const uri = process.env.MONGODB_TEST_URI;
if (!uri || !/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+$/.test(uri))
  throw new Error("A disposable loopback MONGODB_TEST_URI is required");
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
const db = client.db(`aux_contract_${randomUUID().replaceAll("-", "")}`);
const jobs = db.collection("game_jobs");
before(async () => {
  await client.connect();
  await jobs.createIndex({ roomId: 1 }, { unique: true, name: "unique_room_id" });
  await jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_match_jobs" });
});
after(async () => {
  try {
    await db.dropDatabase();
  } finally {
    await client.close();
  }
});

test("two processes cannot claim the same match room", async () => {
  const claim = { roomId: randomUUID(), digest: "same-input", status: "running" };
  const attempts = await Promise.allSettled([
    jobs.insertOne({ ...claim }),
    jobs.insertOne({ ...claim }),
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.find((result) => result.status === "rejected").reason.code, 11000);
  assert.equal(await jobs.countDocuments({ roomId: claim.roomId }), 1);
});

test("a stale process cannot settle or fail a replacement claim", async () => {
  const roomId = randomUUID(),
    digest = "deterministic-input";
  const old = await jobs.insertOne({ roomId, digest, status: "running" });
  await jobs.deleteOne({ _id: old.insertedId });
  const current = await jobs.insertOne({ roomId, digest, status: "running" });
  await assert.rejects(
    completeMatchJob(jobs, old.insertedId, digest, { score: [99, 0] }, 1),
    /match_claim_lost/,
  );
  assert.equal((await failMatchJob(jobs, old.insertedId, digest)).matchedCount, 0);
  await completeMatchJob(
    jobs,
    current.insertedId,
    digest,
    { score: [2, 1], checksum: "replayed" },
    150,
  );
  await assert.rejects(
    completeMatchJob(jobs, current.insertedId, digest, { score: [3, 0] }, 1),
    /match_claim_lost/,
  );
  const second = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  try {
    await second.connect();
    const persisted = await second.db(db.databaseName).collection("game_jobs").findOne({ roomId });
    assert.equal(persisted.status, "finished");
    assert.deepEqual(persisted.result, { score: [2, 1], checksum: "replayed" });
    assert.equal(persisted.durationMs, 150);
    assert.ok(persisted.completedAt instanceof Date);
    assert.ok(persisted._id.equals(current.insertedId));
  } finally {
    await second.close();
  }
});

test("only explicitly expiring jobs qualify for TTL cleanup", async () => {
  const indexes = await jobs.listIndexes().toArray();
  const ttl = indexes.find((index) => index.name === "ttl_match_jobs");
  assert.deepEqual(ttl.key, { expiresAt: 1 });
  assert.equal(ttl.expireAfterSeconds, 0);
  assert.equal(indexes.find((index) => index.name === "unique_room_id").unique, true);
});
