import { describe, expect, it } from "vitest";
import { faceMorphology } from "./player-morphology";
import { lookFor, proportionsFor } from "./player-model";
import { faceSurfaceZ, headPoint, sculptedBeard, sculptedHead } from "./player-sculpt";
import { anatomicalLimb, fittedLimbCover } from "./rig-geometry";
import { LOW_HAIR_FAMILIES, lowHairFamily, lowHairGeometry } from "./player-lod-hair";

describe("athlete morphology", () => {
  it("fits distinct beards below the cheeks with bounded chin volume and no extra groups", () => {
    const look = lookFor("beard-fit", "MF"),
      P = proportionsFor(look);
    const skull = sculptedHead(P, look.seed);
    const skullPoints = skull.getAttribute("position");
    for (const beard of ["stubble", "full", "goatee", "moustache"] as const) {
      const geometry = sculptedBeard(P, { ...look, beard });
      const points = geometry.getAttribute("position");
      expect(Array.from(points.array).every(Number.isFinite)).toBe(true);
      expect(geometry.groups).toHaveLength(0);
      for (let i = 0; i < points.count; i++) {
        const y = points.getY(i);
        expect(y).toBeLessThan(-P.headR * 0.1);
        // Distance to the skull remains meaningful at the tangential cheek
        // edge, where comparing only Z at the extruded X would be misleading.
        if (i % 7 === 0) {
          let nearest = Infinity;
          for (let j = 0; j < skullPoints.count; j++) {
            const dx = points.getX(i) - skullPoints.getX(j);
            const dy = y - skullPoints.getY(j);
            const dz = points.getZ(i) - skullPoints.getZ(j);
            nearest = Math.min(nearest, dx * dx + dy * dy + dz * dz);
          }
          expect(Math.sqrt(nearest)).toBeLessThan(P.headR * 0.11);
        }
      }
      geometry.dispose();
    }
    skull.dispose();
  });
  it("uses lighter match topology while retaining the portrait head silhouette and color", () => {
    const look = lookFor("portrait-detail", "FW"),
      P = proportionsFor(look);
    const portrait = sculptedHead(P, look.seed, true, true);
    const match = sculptedHead(P, look.seed, true, false);
    expect(match.index!.count).toBeLessThan(portrait.index!.count * 0.45);
    portrait.computeBoundingBox();
    match.computeBoundingBox();
    expect(match.boundingBox!.min.distanceTo(portrait.boundingBox!.min)).toBeLessThan(0.002);
    expect(match.boundingBox!.max.distanceTo(portrait.boundingBox!.max)).toBeLessThan(0.002);
    expect(match.getAttribute("color").count).toBe(match.getAttribute("position").count);
    portrait.dispose();
    match.dispose();
  });
  it("adds stable, distinct facial identities without consuming the saved look stream", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const original = lookFor(`identity-${i}`, "MF");
      const face = faceMorphology(original.seed);
      seen.add(JSON.stringify(face));
      expect(faceMorphology(original.seed)).toEqual(face);
      expect(lookFor(`identity-${i}`, "MF")).toEqual(original);
      expect(Object.values(face).every(Number.isFinite)).toBe(true);
    }
    expect(seen.size).toBe(80);
  });

  it("places facial details on the same morphed head across jaw and cheek variations", () => {
    for (let i = 0; i < 30; i++) {
      const look = lookFor(`surface-${i}`, "DF"),
        P = proportionsFor(look);
      for (const y of [-0.9, -0.5, -0.14, 0.14, 0.48])
        for (const angle of [-0.6, -0.3, 0, 0.3, 0.6]) {
          const point = headPoint(P, y, angle, look.seed);
          expect(faceSurfaceZ(P, point.x, point.y, look.seed)).toBeCloseTo(point.z, 8);
        }
    }
  });

  it("fits every sock height over the sculpted calf without exposing skin", () => {
    const limb = anatomicalLimb("calf", 0.44, 0.072, 16);
    const skin = limb.getAttribute("position");
    for (const from of [0, 0.15, 0.38, 0.62]) {
      const cover = fittedLimbCover("calf", 0.44, 0.072, 16, from);
      const cloth = cover.getAttribute("position");
      for (let i = 0; i < skin.count; i++) {
        if (skin.getY(i) > -0.44 * from - 1e-6) continue;
        const side = i % 17;
        const matched = Array.from({ length: cloth.count / 17 }, (_, row) => row * 17 + side).find(
          (j) => Math.abs(cloth.getY(j) - skin.getY(i)) < 1e-6,
        );
        expect(matched).toBeDefined();
        const j = matched!;
        expect(
          Math.hypot(cloth.getX(j), cloth.getZ(j)) - Math.hypot(skin.getX(i), skin.getZ(i)),
        ).toBeCloseTo(0.002, 6);
      }
      expect(Array.from(cover.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      cover.dispose();
    }
    limb.dispose();
  });

  it("retains distinct distant haircut silhouettes with a fixed set of batches", () => {
    expect(lowHairFamily("afro")).toBe("textured");
    expect(lowHairFamily("bun")).toBe("tied");
    expect(lowHairFamily("mohawk")).toBe("crest");
    const boxes = LOW_HAIR_FAMILIES.map((family) => {
      const geometry = lowHairGeometry(family);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!.clone();
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
      return box;
    });
    expect(boxes[1]!.max.y).toBeGreaterThan(boxes[0]!.max.y);
    expect(boxes[2]!.min.z).toBeLessThan(boxes[0]!.min.z);
    expect(boxes[3]!.max.y).toBeGreaterThan(boxes[0]!.max.y);
  });

  it("keeps the short leg outside the quadriceps even at the muscular front", () => {
    const radial = 16;
    const limb = anatomicalLimb("thigh", 0.44, 0.09, radial);
    const cover = fittedLimbCover("thigh", 0.44, 0.09, radial, -0.05, 0.011, 0.52);
    const skin = limb.getAttribute("position"),
      cloth = cover.getAttribute("position");
    for (let i = 0; i < skin.count; i++) {
      if (skin.getY(i) < -0.44 * 0.52) continue;
      const side = i % (radial + 1);
      const match = Array.from(
        { length: cloth.count / (radial + 1) },
        (_, row) => row * (radial + 1) + side,
      ).find((j) => Math.abs(cloth.getY(j) - skin.getY(i)) < 1e-6);
      expect(match).toBeDefined();
      expect(
        Math.hypot(cloth.getX(match!), cloth.getZ(match!)) - Math.hypot(skin.getX(i), skin.getZ(i)),
      ).toBeGreaterThan(0.0109);
    }
    limb.dispose();
    cover.dispose();
  });
});
