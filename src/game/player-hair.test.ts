import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { buildSculptedFace, sculptedHair } from "./player-sculpt";

const look = { ...lookFor("studio-fla-MF-1", "MF", true), beard: "none" as const };
const P = proportionsFor(look);
const kit = {
  base: "#af1830",
  detail: "#15191f",
  pattern: "hoops" as const,
  shorts: "#eeeeee",
  socks: "#171b20",
};

function looseHair(style: "ponytail" | "dreads" | "braids") {
  const styled = { ...look, hairStyle: style };
  return buildSculptedFace(P, styled, playerMaterials(styled, kit, null, "alta"), true);
}

function ringRadius(geometry: THREE.BufferGeometry, row: number, ringSize = 6) {
  const positions = geometry.getAttribute("position");
  const centre = new THREE.Vector3();
  for (let col = 0; col < ringSize - 1; col++)
    centre.add(new THREE.Vector3().fromBufferAttribute(positions, row * ringSize + col));
  centre.divideScalar(ringSize - 1);
  let squaredRadius = 0;
  for (let col = 0; col < ringSize - 1; col++)
    squaredRadius += new THREE.Vector3()
      .fromBufferAttribute(positions, row * ringSize + col)
      .distanceToSquared(centre);
  return Math.sqrt(squaredRadius / (ringSize - 1));
}

describe("football hair silhouettes", () => {
  it("keeps the frontal scalp normal continuous at the atlas seam in every detail tier", () => {
    for (const detail of [false, true])
      for (const hairStyle of ["buzz", "short", "curly", "afro", "braids"] as const) {
        const columns = detail ? 120 : 18;
        const geometry = sculptedHair(P, { ...look, hairStyle }, detail);
        const position = geometry.getAttribute("position");
        const normal = geometry.getAttribute("normal");
        for (let row = 0; row < position.count; row += columns + 1) {
          expect(position.getX(row)).toBeCloseTo(position.getX(row + columns), 6);
          expect(position.getY(row)).toBeCloseTo(position.getY(row + columns), 6);
          expect(position.getZ(row)).toBeCloseTo(position.getZ(row + columns), 6);
          const a = new THREE.Vector3().fromBufferAttribute(normal, row);
          const b = new THREE.Vector3().fromBufferAttribute(normal, row + columns);
          expect(a.dot(b)).toBeGreaterThan(0.99999);
        }
        geometry.dispose();
      }
  });

  it("tapers loose lock tips while retaining their bounded existing tube topology", () => {
    for (const style of ["ponytail", "dreads", "braids"] as const) {
      const face = looseHair(style);
      expect(face.hairSecondary.length).toBeGreaterThan(0);
      for (const part of face.hairSecondary) {
        const geometry = part.geometry;
        const rings = geometry.getAttribute("position").count / 6;
        expect(Number.isInteger(rings)).toBe(true);
        expect(rings).toBeLessThanOrEqual(style === "ponytail" ? 13 : 10);
        const bodyRadius = ringRadius(geometry, 3);
        expect(ringRadius(geometry, rings - 1)).toBeLessThan(bodyRadius * 0.5);
        expect(ringRadius(geometry, rings - 1)).toBeGreaterThan(bodyRadius * 0.25);
        expect(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      }
      for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
    }
  });

  it("gives braids a different woven lock surface from dreads for the same athlete", () => {
    const dreads = looseHair("dreads");
    const braids = looseHair("braids");
    expect(braids.hairSecondary).toHaveLength(dreads.hairSecondary.length);
    const dread = dreads.hairSecondary[0]!.geometry.getAttribute("position");
    const braid = braids.hairSecondary[0]!.geometry.getAttribute("position");
    expect(braid.count).toBe(dread.count);
    let difference = 0;
    for (let i = 0; i < braid.count; i++)
      difference += new THREE.Vector3()
        .fromBufferAttribute(braid, i)
        .distanceTo(new THREE.Vector3().fromBufferAttribute(dread, i));
    expect(difference / braid.count).toBeGreaterThan(P.headR * 0.001);
    for (const face of [dreads, braids])
      for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
  });
});
