import { expect, it } from "vitest";
import { Vector3 } from "three";
import { lookFor, proportionsFor } from "./player-model";
import { scalpGeometry } from "./rig-geometry";
import { sculptedHair, sculptedHead } from "./player-sculpt";
import { headPoint, headAngle, fittedHairlineY } from "./sculpt/head";
import { faceMorphology } from "./player-morphology";

it("keeps buzz stubble against the seeded scalp without a short-hair forelock", () => {
  const look = { ...lookFor("buzz-closeup", "MF"), hairStyle: "buzz" as const };
  const p = proportionsFor(look),
    face = faceMorphology(look.seed);
  for (const detail of [false, true]) {
    const hair = sculptedHair(p, look, detail),
      positions = hair.getAttribute("position");
    const columns = detail ? 120 : 18,
      rows = detail ? 72 : 10;
    let maximumProjection = 0;
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++) {
        const angle = headAngle(col / columns),
          line = fittedHairlineY(angle, face, detail);
        const scalp = headPoint(p, line + ((1.14 - line) * row) / rows, angle, look.seed);
        const point = new Vector3().fromBufferAttribute(positions, row * (columns + 1) + col);
        maximumProjection = Math.max(maximumProjection, point.distanceTo(scalp));
      }
    expect(maximumProjection).toBeLessThan(0.001);
    expect(hair.getAttribute("color")).toBeDefined();
    hair.dispose();
  }
});

it("changes hairstyles without changing bones or stature", () => {
  const look = lookFor("same-athlete", "MF");
  expect(proportionsFor({ ...look, hairStyle: "afro", hairVolume: 1.2 })).toEqual(
    proportionsFor({ ...look, hairStyle: "bald", hairVolume: 0.9 }),
  );
  expect(lookFor("keeper", "gk").gloves).toBe(true);
});

it("keeps the frontal hairline above the eyes with finite surface normals", () => {
  const geometry = scalpGeometry(1);
  const position = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  for (let index = 0; index < position.count; index++) {
    if (position.getZ(index) > 0.7 && Math.abs(position.getX(index)) < 0.45)
      expect(position.getY(index)).toBeGreaterThan(0.35);
  }
  expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
  geometry.dispose();
});

it("preserves skull scale and a clear eye line in both sculpted levels of detail", () => {
  for (const detail of [false, true]) {
    const look = lookFor("sculpted-anatomy", "GK");
    const p = proportionsFor(look);
    const head = sculptedHead(p, look.seed, detail);
    head.computeBoundingBox();
    expect(head.boundingBox!.max.y - head.boundingBox!.min.y).toBeCloseTo(p.headH, 6);
    for (const hairStyle of ["short", "buzz", "curly", "afro", "medium"] as const) {
      const hair = sculptedHair(p, { ...look, hairStyle }, detail);
      const positions = hair.getAttribute("position");
      for (let index = 0; index < positions.count; index++) {
        if (
          positions.getZ(index) > p.headD * 0.7 &&
          Math.abs(positions.getX(index)) < p.headW * 0.4
        )
          expect(positions.getY(index)).toBeGreaterThan(p.headR * 0.35);
      }
      expect(Array.from(hair.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      hair.dispose();
    }
    expect(Array.from(head.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    head.dispose();
  }
});

it("breaks short and medium hairline silhouettes at portrait scale while preserving other cuts", () => {
  const look = lookFor("studio-fla-MF-1", "MF", true),
    face = faceMorphology(look.seed);
  for (const detail of [false, true]) {
    for (const style of [
      "buzz",
      "curly",
      "afro",
      "braids",
      "dreads",
      "bun",
      "ponytail",
      "mohawk",
    ] as const)
      for (const angle of [0, 0.35, 0.7, 1.2, 2.8])
        expect(fittedHairlineY(angle, face, detail, style)).toBe(
          fittedHairlineY(angle, face, detail),
        );
    for (const style of ["short", "medium"] as const) {
      const deviations = [-0.8, -0.4, 0, 0.4, 0.8].map(
        (angle) =>
          fittedHairlineY(angle, face, detail, style) - fittedHairlineY(angle, face, detail),
      );
      // Macro temporal recession plus a lowered off-centre forelock must
      // change the contour at centimetre scale, not only vary fibre pigment.
      expect(Math.max(...deviations) - Math.min(...deviations)).toBeGreaterThan(0.06);
      expect(fittedHairlineY(0, face, detail, style)).toBeGreaterThan(0.35);
      expect(fittedHairlineY(0, face, detail, style)).toBeCloseTo(
        fittedHairlineY(Math.PI * 2, face, detail, style),
        12,
      );
    }
  }
});
