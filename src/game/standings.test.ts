import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { simulateDivisionTable } from "./standings";

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
