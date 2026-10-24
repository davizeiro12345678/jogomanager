import { afterEach, expect, it, vi } from "vitest";
import { cinematicLook } from "./cinematic-actor";
import { cinematicDetail } from "./cinematic-performance";
import { compactCinematicSkin } from "./cinematic-skin";
import { playerMaterials } from "./player-materials";
import { proportionsFor } from "./player-model";
import { buildRigSkin, countRigSkinTriangles } from "./rig-skin";
import { buildRigBody, type RigBodyContext } from "./rig-body";

afterEach(() => vi.restoreAllMocks());

for (const quality of ["baixa", "media", "alta"] as const) {
  for (const [seed, hero] of [
    [71, true],
    [72, false],
    [73, false],
    [77, true],
  ] as const) {
    it(`keeps every arrival costume mergeable at ${quality}, seed ${seed}`, () => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(`${args.join(" ")}\n${new Error().stack}`);
      });
      const look = { ...cinematicLook(seed), sleeves: "short" as const, collar: "crew" as const };
      const detail = cinematicDetail(quality, hero);
      const p = proportionsFor(look);
      const kit = {
        base: "#087f43",
        shorts: "#12181c",
        socks: "#12181c",
        detail: "#087f43",
        pattern: "solid" as const,
      };
      const base = playerMaterials(look, kit, null, detail.high ? "alta" : "media");
      const mats = { ...base, jerseyPlain: base.jersey, trim: base.jersey, socks: base.shorts };
      const context: RigBodyContext = {
        P: p,
        look,
        mats,
        hi: detail.portrait,
        portrait: detail.portrait,
        segs: { radial: detail.radial, cap: 4 },
        jerseyInk: kit.base,
        handR: p.handR,
        handMat: mats.skin,
      };
      const body = buildRigBody(context);
      const expectedTriangles = body.all.reduce(
        (sum, part) =>
          sum + (part.geometry.index?.count ?? part.geometry.getAttribute("position").count) / 3,
        0,
      );
      for (const part of body.all) part.geometry.dispose();
      const built = buildRigSkin(context, [0, 0, 0], { mergeLods: true });
      const before = countRigSkinTriangles(built);
      const skin = detail.portrait ? built : compactCinematicSkin(built);
      try {
        expect(before).toBe(expectedTriangles);
        expect(countRigSkinTriangles(skin)).toBe(before);
        expect(errors).toEqual([]);
      } finally {
        skin.dispose();
      }
    });
  }
}
