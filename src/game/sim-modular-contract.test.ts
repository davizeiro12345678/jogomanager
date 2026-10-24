import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { it, expect } from "vitest";
import { MatchSim } from "./sim";
import { buildTeamSetup } from "./quickMatch";

// Earlier original/reporting/set-piece fixtures remain untouched. This revision
// repairs goal geometry, aerodynamic units, challenge reach and first touches.
// These causal changes deliberately alter future outcomes, with separate red/
// green regressions and paired match traces rather than goal-rate adjustments.
const baseline = new URL("./fixtures/sim-realism-20261020-digests.json", import.meta.url);
const update = process.env["PFM_CAPTURE_SIM_BASELINE"] === "1";
const expected: Record<string, string> = update ? {} : JSON.parse(readFileSync(baseline, "utf8"));
it.each(["clear", "rain", "heat"] as const)(
  "preserves the complete %s state after the verified football rule corrections",
  (weather) => {
    const sim = new MatchSim(
      buildTeamSetup("fla"),
      buildTeamSetup("pal"),
      "modular-contract-2026-10-13",
      { weather },
    );
    for (let tick = 0; tick < 1800; tick++) sim.step(0.5);
    const checkpoint = sim.checkpoint();
    expect(checkpoint.version).toBe(2);
    expect(checkpoint.execution).toEqual({ revision: 3, physics: "compat", perception: "compat" });
    // The captured v1 envelope predates execution metadata. Keep every state,
    // RNG and integration-journal value, and validate today's v2 contract above.
    // These exact v1 bytes reproduce all three original golden digests.
    const legacyEnvelope = {
      version: 1,
      seed: checkpoint.seed,
      rng: checkpoint.rng,
      state: checkpoint.state,
      physics: checkpoint.physics,
      athleteRemainders: checkpoint.athleteRemainders,
      perception: checkpoint.perception,
    };
    const json = JSON.stringify(legacyEnvelope, (_, value) =>
      value instanceof Map ? [...value] : value instanceof Set ? [...value] : value,
    );
    const digest = createHash("sha256").update(json).digest("hex");
    if (update) {
      expected[weather] = digest;
      writeFileSync(baseline, JSON.stringify(expected, null, 2) + "\n");
    } else expect(digest).toBe(expected[weather]);
    sim.dispose();
  },
);
