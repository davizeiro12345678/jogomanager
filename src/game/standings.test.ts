import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { simulateDivisionTable } from "./standings";
import { hashSeed, makeRng } from "./rng";
import { teamDay } from "./match-probability";

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
