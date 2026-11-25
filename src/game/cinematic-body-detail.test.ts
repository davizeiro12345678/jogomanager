import { describe, expect, it } from "vitest";
import { cinematicDetail } from "./cinematic-performance";
import { buildRigBody, type RigBodyContext } from "./rig-body";
import { buildRigSkin } from "./rig-skin";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";

describe("full-body narrative mesh refinement", () => {
  it("raises the radial detail only for the principal low-tier actor", () => {
    expect(cinematicDetail("baixa", true).radial).toBe(12);
    expect(cinematicDetail("baixa", false).radial).toBe(8);
    expect(cinematicDetail("media", true).radial).toBe(12);
    expect(cinematicDetail("alta", true).radial).toBe(16);
  });

  it("refines torso, pelvis, neck, arms, hands, legs and boots with unchanged rig joints", () => {
    const look = { ...lookFor("narrative-full-body", "MF"), sleeves: "short" as const };
    const P = proportionsFor(look);
    const kit = {
      base: "#a31b32",
      detail: "#fff",
      shorts: "#171b20",
      socks: "#a31b32",
      pattern: "solid",
    } as const;
    const mats = playerMaterials(look, kit, null, "media");
    const base: RigBodyContext = {
      P,
      look,
      mats,
      hi: false,
      portrait: false,
      segs: { radial: 8, cap: 4 },
      handR: P.handR,
      handMat: mats.skin,
      jerseyInk: "#fff",
    };
    const refined = {
      ...base,
      segs: { radial: cinematicDetail("baixa", true).radial, cap: 4 },
      headSampling: cinematicDetail("baixa", true).headSampling,
    };
    const a = buildRigBody(base),
      b = buildRigBody(refined);
    const n = (parts: typeof a.spine) =>
      parts.reduce(
        (sum, mesh) =>
          sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3,
        0,
      );
    try {
      for (const key of [
        "hips",
        "spine",
        "neck",
        "armL",
        "armR",
        "foreL",
        "foreR",
        "handL",
        "handR",
        "legL",
        "legR",
        "kneeL",
        "kneeR",
        "ankleL",
        "ankleR",
      ] as const) {
        expect(n(b[key]), key).toBeGreaterThan(n(a[key]));
        expect(b[key].length, key).toBe(a[key].length);
        for (const part of b[key]) {
          expect(
            Array.from(part.geometry.getAttribute("position").array).every(Number.isFinite),
            key,
          ).toBe(true);
          expect(
            Array.from(part.geometry.getAttribute("normal").array).every(Number.isFinite),
            key,
          ).toBe(true);
        }
      }
      console.log(
        "BODY_TRIANGLES",
        JSON.stringify(
          Object.fromEntries(
            (
              [
                "hips",
                "spine",
                "neck",
                "armL",
                "foreL",
                "handL",
                "legL",
                "kneeL",
                "ankleL",
              ] as const
            ).map((k) => [k, [n(a[k]), n(b[k])]]),
          ),
        ),
      );
    } finally {
      a.all.forEach((m) => m.geometry.dispose());
      b.all.forEach((m) => m.geometry.dispose());
    }
    const x = buildRigSkin(base, [0, 0, 0], { mergeLods: true }),
      y = buildRigSkin(refined, [0, 0, 0], { mergeLods: true });
    try {
      expect(y.bones.map((b) => [b.name, ...b.position.toArray()])).toEqual(
        x.bones.map((b) => [b.name, ...b.position.toArray()]),
      );
      expect(y.groups.length).toBe(x.groups.length);
      for (const part of y.groups) {
        const weights = part.geometry.getAttribute("skinWeight");
        for (let i = 0; i < weights.count; i++)
          expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(
            1,
            5,
          );
      }
      console.log("RIG_GROUPS", x.groups.length, y.groups.length);
    } finally {
      x.dispose();
      y.dispose();
    }
  });
});
