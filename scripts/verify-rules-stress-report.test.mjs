import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

function verify(mutate = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), "rules-stress-gate-"));
  try {
    const report = {
      success: true,
      testResults: [
        {
          name: "/repo/src/game/sim-rules-revision.stress.test.ts",
          status: "passed",
          assertionResults: Array.from({ length: 200 }, (_, index) => ({
            fullName: `MatchSim rules revision 2 stress rules-stress-${index} finishes and reproduces canonical state`,
            status: "passed",
          })),
        },
      ],
    };
    mutate(report);
    const input = path.join(root, "report.json");
    writeFileSync(input, JSON.stringify(report));
    return spawnSync(
      process.execPath,
      [fileURLToPath(new URL("./verify-rules-stress-report.mjs", import.meta.url)), input],
      { encoding: "utf8" },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("revised-rules stress gate accepts all 200 individually executed seeds", () => {
  const result = verify();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /200 seeds and 200 independent replays/);
});
test("revised-rules stress gate rejects missing, skipped, failed or duplicate seed coverage", () => {
  for (const mutate of [
    (r) => {
      r.success = false;
    },
    (r) => {
      r.testResults = [];
    },
    (r) => {
      r.testResults[0].name = "/repo/src/game/sim.stress.test.ts";
    },
    (r) => {
      r.testResults[0].assertionResults.pop();
    },
    (r) => {
      r.testResults[0].assertionResults[0].status = "pending";
    },
    (r) => {
      r.testResults[0].assertionResults[0].status = "failed";
    },
    (r) => {
      r.testResults[0].assertionResults[199] = r.testResults[0].assertionResults[0];
    },
    (r) => {
      r.testResults[0].assertionResults[199].fullName =
        "MatchSim rules revision 2 stress rules-stress-200 finishes and reproduces canonical state";
    },
  ]) {
    const result = verify(mutate);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /complete revision 2 stress campaign/);
  }
});
