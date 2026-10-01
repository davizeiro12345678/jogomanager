import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { anatomicalLimb } from "./rig-geometry";
import { buildRigSkin, countRigSkin } from "./rig-skin";
import { HERO_MESH_COST } from "./draw-budget";
import { lookFor, proportionsFor, type HairStyle } from "./player-model";
import { playerMaterials } from "./player-materials";
import { buildSculptedFace, faceSurfaceZ, sculptedHair, sculptedHead } from "./player-sculpt";

const kit = {
  base: "#af1830",
  detail: "#15191f",
  pattern: "hoops",
  shorts: "#eee",
  socks: "#171b20",
} as const;
const look = lookFor("studio-fla-MF-1", "MF", true);
const P = proportionsFor(look);

describe("sculpted football player", () => {
  it("preserves adult skull height and a tapered jaw with finite outward normals", () => {
    const geometry = sculptedHead(P, look.seed);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(P.headH, 5);
    expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    expect(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    const position = geometry.getAttribute("position"),
      normal = geometry.getAttribute("normal");
    let jawWidth = 0,
      cheekWidth = 0;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i) / P.headR;
      if (y < -0.85) jawWidth = Math.max(jawWidth, Math.abs(position.getX(i)));
      if (Math.abs(y) < 0.3) cheekWidth = Math.max(cheekWidth, Math.abs(position.getX(i)));
      if (position.getZ(i) > P.headD * 0.95 && Math.abs(y) < 0.35)
        expect(normal.getZ(i)).toBeGreaterThan(0);
    }
    expect(jawWidth).toBeLessThan(cheekWidth * 0.8);
    geometry.dispose();
  });

  it("embeds almond eyes in the sculpted sockets instead of floating eyeballs", () => {
    const mats = playerMaterials(look, kit, null, "alta");
    const face = buildSculptedFace(P, look, mats, true);
    const lenses = face.face.filter(
      (part) => (part.material as THREE.MeshStandardMaterial).color?.getHexString() === "c9c3b8",
    );
    expect(lenses).toHaveLength(2);
    for (const lens of lenses) {
      const points = lens.geometry.getAttribute("position");
      for (let i = 0; i < points.count; i++) {
        const projection =
          points.getZ(i) - faceSurfaceZ(P, points.getX(i), points.getY(i), look.seed);
        expect(projection).toBeGreaterThan(0);
        expect(projection).toBeLessThan(P.headR * 0.05);
      }
    }
    for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
  });

  it("keeps the fitted frontal hairline above the eyes in every haircut", () => {
    const styles: HairStyle[] = [
      "buzz",
      "short",
      "medium",
      "curly",
      "afro",
      "mohawk",
      "bun",
      "ponytail",
      "dreads",
      "braids",
    ];
    for (const hairStyle of styles) {
      const hair = sculptedHair(P, { ...look, hairStyle });
      const points = hair.getAttribute("position");
      for (let i = 0; i < points.count; i++) {
        if (points.getZ(i) > P.headD * 0.6 && Math.abs(points.getX(i)) < P.headW * 0.3)
          expect(points.getY(i)).toBeGreaterThan(P.headR * 0.35);
      }
      expect(Array.from(hair.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      hair.dispose();
    }
  });

  it("joins upper and lower limb ellipses without exposed cap faces", () => {
    for (const [upper, lower, length] of [
      ["upperArm", "forearm", P.upperArm],
      ["thigh", "calf", P.thigh],
    ] as const) {
      const a = anatomicalLimb(upper, length, 0.07, 16),
        b = anatomicalLimb(lower, 0.35, 0.07, 16);
      const pa = a.getAttribute("position"),
        pb = b.getAttribute("position");
      const na = a.getAttribute("normal"),
        nb = b.getAttribute("normal");
      const row = pb.count - 17;
      for (let i = 0; i <= 16; i++) {
        expect(pa.getX(i)).toBeCloseTo(pb.getX(row + i), 6);
        expect(pa.getZ(i)).toBeCloseTo(pb.getZ(row + i), 6);
        expect(na.getY(i)).toBe(0);
        expect(nb.getY(row + i)).toBe(0);
      }
      a.dispose();
      b.dispose();
    }
  });

  it("accounts for material and shadow draws across roles, haircuts and accessories", () => {
    const costs: number[] = [];
    for (const pos of ["MF", "FW", "DF", "GK"])
      for (let seed = 0; seed < 4; seed++)
        for (const sleeves of ["short", "long"] as const)
          for (const hairStyle of ["bald", "short", "afro", "dreads"] as const) {
            const styled = {
              ...lookFor(`budget-${pos}-${seed}`, pos, true),
              sleeves,
              hairStyle,
              beard: "full" as const,
              earring: true,
              wristTape: "left" as const,
              tattoo: "foreR" as const,
              headband: true,
              sockTape: true,
              collar: "polo" as const,
            };
            const proportions = proportionsFor(styled),
              mats = playerMaterials(styled, kit, null, "alta");
            const skin = buildRigSkin(
              {
                P: proportions,
                look: styled,
                segs: { radial: 16, cap: 4 },
                hi: true,
                mats,
                handR: proportions.handR * (styled.gloves ? 1.25 : 1),
                handMat: styled.gloves ? mats.glove : mats.skin,
                jerseyInk: "#fff",
              },
              [0, 0, 0],
            );
            costs.push(
              countRigSkin(skin) +
                skin.groups.filter((group) => group.castShadow && group.lod === "core").length,
            );
            skin.dispose();
          }
    expect(Math.max(...costs)).toBeLessThanOrEqual(HERO_MESH_COST);
  });
});
