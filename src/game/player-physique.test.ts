import { expect, it } from "vitest";
import { profileFor } from "./attributes";
import { physiqueFor } from "./player-physique";
import { buildTeamSetup } from "./quickMatch";
import type { Position } from "./types";

it("preserves full-profile measurements across positions and random dominant-foot branches", () => {
  const original = buildTeamSetup("fla").players[0]!;
  for (const pos of ["GK", "DF", "MF", "FW"] satisfies Position[]) {
    for (let index = 0; index < 32; index++) {
      const player = { ...original, id: `physique-${pos}-${index}`, name: `Atleta ${index}`, pos };
      const profile = profileFor(player);
      expect(physiqueFor(player)).toEqual({ height: profile.height, weight: profile.weight });
    }
  }
});
