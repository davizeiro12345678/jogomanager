import test from "node:test";
import assert from "node:assert/strict";
import { assessSetupParity } from "./match-setup-parity.mjs";

function report(revision, executionRevision, hash) {
  return {
    revision,
    executionContract: { revision: executionRevision, physics: "compat", perception: "compat" },
    environment: {
      node: "v24.22.0",
      platform: "linux",
      architecture: "x64",
      kernel: "same kernel",
      cpu: "shared runner",
    },
    fixtureSha256: "f".repeat(64),
    checkpoints: Array.from({ length: 21 }, (_, tick) => ({
      seed: ["bench-setup", "setup-parity-1", "setup-parity-2"][Math.floor(tick / 7)],
      tick: (tick % 7) * 300,
      sha256: hash.repeat(64),
    })),
  };
}
const abba = (oldRevision = 2, newRevision = 3) => [
  report("baseline", oldRevision, "a"),
  report("candidate", newRevision, "b"),
  report("candidate", newRevision, "b"),
  report("baseline", oldRevision, "a"),
];
test("accepts independently reproducible physics after a declared adjacent execution revision change", () => {
  const result = assessSetupParity(abba());
  assert.deepEqual(result.violations, []);
  assert.equal(result.crossRevisionEqualityRequired, false);
});
test("requires cross-revision checkpoint equality when execution revision is unchanged", () => {
  assert.match(assessSetupParity(abba(3, 3)).violations.join("\n"), /Same-revision/);
});
test("never hides nondeterminism within a candidate or baseline behind a revision change", () => {
  for (const index of [2, 3]) {
    const samples = abba();
    samples[index].checkpoints[5].sha256 = "c".repeat(64);
    assert.match(assessSetupParity(samples).violations.join("\n"), /independent deterministic/);
  }
});
test("rejects missing samples, missing metadata, empty snapshots and backend changes", () => {
  const variants = [abba().slice(0, 3), abba(), abba(), abba(), abba()];
  delete variants[1][1].executionContract;
  variants[2][1].checkpoints = [];
  variants[3][1].executionContract.physics = "rapier";
  variants[4][1].fixtureSha256 = "changed fixture";
  for (const samples of variants) assert.ok(assessSetupParity(samples).violations.length > 0);
});
test("rejects undeclared or unsupported revision transitions and changed runtime", () => {
  const samples = abba(1, 3);
  assert.match(assessSetupParity(samples).violations.join("\n"), /Unexpected/);
  samples[1].executionContract.revision = 4;
  samples[3].environment.cpu = "different runner";
  assert.match(assessSetupParity(samples).violations.join("\n"), /unsupported/);
  assert.match(assessSetupParity(samples).violations.join("\n"), /Runtime or CPU/);
});
test("requires all three seeds at seven distinct instants and complete runtime metadata", () => {
  const variants = [abba(), abba(), abba(), abba()];
  variants[0][1].checkpoints[1] = { ...variants[0][1].checkpoints[0] };
  variants[1][1].checkpoints[7].seed = "bench-setup";
  variants[2].forEach((sample) => {
    delete sample.environment;
  });
  variants[3].forEach((sample) => {
    sample.fixtureSha256 = "missing fixture hash";
  });
  for (const samples of variants) assert.ok(assessSetupParity(samples).violations.length > 0);
});
