// Fence every state transition with the unique MongoDB claim ID. A stale
// process must never finish or fail a replacement claim for the same room.
export async function completeMatchJob(jobs, claimId, digest, result, durationMs) {
  const update = await jobs.updateOne(
    { _id: claimId, digest, status: "running" },
    { $set: { status: "finished", result, durationMs, completedAt: new Date() } },
  );
  if (update.matchedCount !== 1) throw new Error("match_claim_lost");
}

export async function failMatchJob(jobs, claimId, digest) {
  return jobs.updateOne(
    { _id: claimId, digest, status: "running" },
    { $set: { status: "failed", completedAt: new Date() } },
  );
}
