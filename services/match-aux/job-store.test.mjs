import assert from "node:assert/strict";
import { test } from "node:test";
import { completeMatchJob, failMatchJob } from "./job-store.mjs";

function collection(job) {
  return {
    async updateOne(filter, update) {
      const matches = Object.entries(filter).every(([key, value]) => job[key] === value);
      if (matches) Object.assign(job, update.$set);
      return { matchedCount: Number(matches) };
    },
  };
}

test("only the current claim can complete the authoritative match", async () => {
  const job = { _id: "new", digest: "same-room", status: "running" };
  const jobs = collection(job);
  await assert.rejects(
    () => completeMatchJob(jobs, "old", "same-room", {}, 10),
    /match_claim_lost/,
  );
  assert.equal(job.status, "running");
  await completeMatchJob(jobs, "new", "same-room", { hg: 1, ag: 0 }, 10);
  assert.equal(job.status, "finished");
  assert.deepEqual(job.result, { hg: 1, ag: 0 });
});

test("a stale failure cannot invalidate a replacement claim", async () => {
  const job = { _id: "new", digest: "same-room", status: "running" };
  const jobs = collection(job);
  await failMatchJob(jobs, "old", "same-room");
  assert.equal(job.status, "running");
  await failMatchJob(jobs, "new", "same-room");
  assert.equal(job.status, "failed");
});
