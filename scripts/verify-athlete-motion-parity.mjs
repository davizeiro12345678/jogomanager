import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const base = process.argv[2];
if (!base)
  throw new Error("Usage: node --import tsx scripts/verify-athlete-motion-parity.mjs BASE_DIR");
const baseline = await import(
  pathToFileURL(path.resolve(base, "src/game/athlete-dynamics.ts")).href
);
const candidate = await import("../src/game/athlete-dynamics.ts");
let checkpoints = 0;
for (let seed = 0; seed < 256; seed++) {
  const original = {
    x: seed / 7 - 15,
    z: (seed % 31) - 15,
    vx: (seed % 9) - 4,
    vz: (seed % 7) - 3,
    pace: seed % 110,
    physical: seed % 105,
    stamina: seed % 101,
    weightKg: seed % 3 === 0 ? undefined : 40 + (seed % 100),
  };
  const a = { ...original },
    b = { ...original };
  for (let tick = 0; tick < 120; tick++) {
    const args = [
      Math.sin(tick / 13) * 45,
      Math.cos(tick / 9) * 30,
      (seed % 13) * 0.8,
      [1 / 30, 1 / 15, 0.001, 0.4, 0, -1, NaN][tick % 7],
      [0.1, 0.72, 1, 1.5][seed % 4],
    ];
    baseline.advanceAthlete(a, ...args);
    candidate.advanceAthlete(b, ...args);
    assert.deepEqual(b, a, `seed=${seed}, tick=${tick}`);
    assert.equal(candidate.athleteRemainder(b), baseline.athleteRemainder(a));
    checkpoints++;
  }
}
console.log(JSON.stringify({ checkpoints, exactStates: true, remainderParity: true }));
