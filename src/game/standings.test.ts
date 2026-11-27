import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { simulateDivisionTable } from "./standings";
import { hashSeed, makeRng } from "./rng";
import { regulationScore, teamDay } from "./match-probability";

it("preserves the baseline season rankings across national tie-breaker rules", () => {
  // Frozen from main c20036f before moving head-to-head allocations.
  const clubIds = Array.from({ length: 8 }, (_, index) => `club-${index}`);
  const outputs: string[] = [];
  for (const country of [
    "Brasil",
    "Espanha",
    "Portugal",
    "Inglaterra",
    "Alemanha",
    "Itália",
    "Argentina",
    "França",
  ])
    for (let seed = 0; seed < 8; seed++)
      outputs.push(
        JSON.stringify(simulateDivisionTable(clubIds, country, `standings-parity-${seed}`)),
      );
  expect(createHash("sha256").update(outputs.join("\n")).digest("hex")).toBe(
    "fb0729363077b4692cd70bf9495f58421d26ea923c46c3f259e327b2ed93a0b4",
  );
});

it("incremental FNV seed hashing preserves full-seed bitwise parity", () => {
  for (const prefix of ["", "match-day:league-123:", "🌎 temporada:"]) {
    for (const suffix of ["home", "away", "áéíóú", "🦊"]) {
      expect(hashSeed(suffix, hashSeed(prefix))).toBe(hashSeed(prefix + suffix));
    }
  }
});

it("team-day noise keeps the full legacy random sequence", () => {
  for (const seed of ["", "bench-division", "temporada 🏆", "abc".repeat(80)]) {
    for (const side of ["home", "away"] as const) {
      const original = makeRng(`match-day:${seed}:${side}`);
      expect(teamDay(seed, side)).toBe((original() + original() + original() - 1.5) * 4);
    }
  }
});

it("keeps every Poisson bucket and Dixon-Coles threshold deterministic after single-pass accumulation", () => {
  const legacyBuckets = (lambda: number) => {
    const p = [Math.exp(-lambda)];
    for (let i = 1; i < 8; i++) p.push((p[i - 1]! * lambda) / i);
    p.push(Math.max(0, 1 - p.reduce((sum, value) => sum + value, 0)));
    return p;
  };
  const legacyScore = (home: number, away: number, initialRoll: number) => {
    const hp = legacyBuckets(home);
    const ap = legacyBuckets(away);
    const rho = -0.06;
    let roll = initialRoll;
    for (let hg = 0; hg < hp.length; hg++) {
      for (let ag = 0; ag < ap.length; ag++) {
        const tau =
          hg === 0 && ag === 0
            ? 1 - home * away * rho
            : hg === 0 && ag === 1
              ? 1 + home * rho
              : hg === 1 && ag === 0
                ? 1 + away * rho
                : hg === 1 && ag === 1
                  ? 1 - rho
                  : 1;
        roll -= hp[hg]! * ap[ag]! * tau;
        if (roll <= 0) return { hg, ag };
      }
    }
    return { hg: 8, ag: 8 };
  };
  const rates = [0.15, 0.2, 0.5, 0.99, 1.4, 2.3, 3.6, 4.5];
  const rolls = [0, 0.000001, 0.004, 0.03, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98, 0.9999999];
  for (const home of rates) {
    for (const away of rates) {
      for (const roll of rolls) {
        const expected = legacyScore(home, away, roll);
        expect(regulationScore({ home, away }, () => roll)).toEqual(expected);
      }
    }
  }
});
