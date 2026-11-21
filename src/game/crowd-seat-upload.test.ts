import { expect, test } from "vitest";
import { Object3D } from "three";
import { buildCrowdSeatUpload, packCrowdSeats } from "./crowd-seat-upload";

test("portable crowd preparation preserves Three's seat matrices and packed attributes", () => {
  const positions = Array.from({ length: 5_120 }, (_, seat) => ({
    x: seat % 61 === 0 ? 0 : Math.sin(seat * 0.19) * 105,
    y: (seat % 50) / 2,
    z: Math.cos(seat * 0.19) * 66,
  }));
  const colors = positions.map((_, seat) => ({ r: 0.3, g: 0.2, b: seat / 5_120 }));
  const skins = positions.map(() => ({ r: 0.4, g: 0.5, b: 0.6 }));
  const actual = buildCrowdSeatUpload(packCrowdSeats({ positions, colors, skins }));
  const reference = new Object3D();
  const matrices = new Float32Array(positions.length * 16);
  for (const [seat, { x, y, z }] of positions.entries()) {
    const height = 0.9 + (seat % 7) * 0.025;
    reference.position.set(x, y, z);
    reference.scale.set(height * (0.92 + (seat % 3) * 0.06), height, height);
    reference.rotation.set(0, Math.atan2(-x, -z), 0);
    reference.updateMatrix();
    matrices.set(reference.matrix.elements, seat * 16);
  }
  // Signed zero in unused axes has identical behavior in the renderer.
  expect(actual.matrices.findIndex((value, i) => value !== matrices[i])).toBe(-1);
  expect(actual.colors).toEqual(new Float32Array(colors.flatMap(({ r, g, b }) => [r, g, b])));
  expect(actual.skins).toEqual(new Float32Array(skins.flatMap(({ r, g, b }) => [r, g, b])));
  expect(actual.styles).toEqual(
    new Float32Array(positions.flatMap((_, i) => [(i % 13) / 12, (i % 11) / 10])),
  );
});
