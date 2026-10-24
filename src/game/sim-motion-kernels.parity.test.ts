import { describe, expect, it } from "vitest";

import { athleteContact } from "./athlete-dynamics";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, FIELD_Z } from "./sim-rules";
import { separatePlayers } from "./sim-motion-kernels";
import { MatchSim } from "./sim";
import type { SimPlayer } from "./sim-types";

// Independent reference preserving the pre-optimization contact order,
// distance rejection, NaN recovery, impulses and random consumption.
function referenceSeparatePlayers(players: SimPlayer[], holder: string | null, rnd: () => number) {
  const R = 0.85;
  for (let i = 0; i < players.length; i++) {
    const a = players[i]!;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j]!;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      if ((dx > 1.7 || dx < -1.7) && !Number.isNaN(dz)) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 > 2.89) continue;
      let d = Math.sqrt(d2);
      if (d > R * 2) continue;
      if (d < 1e-4) {
        dx = (rnd() - 0.5) * 0.02;
        dz = (rnd() - 0.5) * 0.02;
        d = Math.hypot(dx, dz) || 1e-4;
      }
      const overlap = R * 2 - d;
      const aWeight = a.id === holder ? 0.25 : 1;
      const bWeight = b.id === holder ? 0.25 : 1;
      const totalWeight = aWeight + bWeight;
      const nx = dx / d;
      const nz = dz / d;
      athleteContact(a, b, nx, nz);
      a.x -= nx * overlap * (aWeight / totalWeight);
      a.z -= nz * overlap * (aWeight / totalWeight);
      b.x += nx * overlap * (bWeight / totalWeight);
      b.z += nz * overlap * (bWeight / totalWeight);
    }
  }
  for (const p of players) {
    p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
    p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
  }
}

function seededRandom() {
  let state = 0x3e25a;
  let calls = 0;
  return {
    next() {
      calls++;
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    get calls() {
      return calls;
    },
  };
}

describe("separation broad-phase equivalence", () => {
  it("preserves contact impulses and RNG on realistic and exceptional pitches", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "contact-parity");
    for (const scenario of ["normal", "clustered", "overlap", "nan", "wide"] as const) {
      const original = sim.players.map((p) => ({ ...p }));
      original.forEach((p, index) => {
        if (scenario === "clustered") {
          p.x = (index % 5) * 0.24;
          p.z = (index % 4) * 0.19;
        } else if (scenario === "overlap") {
          p.x = 0;
          p.z = 0;
        } else if (scenario === "nan") {
          if (index === 2) p.x = Number.NaN;
          if (index === 8) p.z = Number.NaN;
        } else if (scenario === "wide") {
          p.x = index * 8 - 65;
          p.z = (index % 2 ? 1 : -1) * 20;
        }
      });
      const candidate = original.map((p) => ({ ...p }));
      for (const holder of [null, original[4]!.id]) {
        const before = original.map((p) => ({ ...p }));
        const after = candidate.map((p) => ({ ...p }));
        const referenceRng = seededRandom();
        const optimizedRng = seededRandom();
        referenceSeparatePlayers(before, holder, () => referenceRng.next());
        separatePlayers(after, holder, () => optimizedRng.next());
        expect(after, `${scenario} holder=${holder}`).toEqual(before);
        expect(optimizedRng.calls, `${scenario} RNG calls`).toBe(referenceRng.calls);
      }
    }
  });
});
