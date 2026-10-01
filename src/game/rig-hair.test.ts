import { expect, it } from "vitest";
import { lookFor, proportionsFor } from "./player-model";
import { scalpGeometry } from "./rig-geometry";
import { sculptedHair, sculptedHead } from "./player-sculpt";

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
