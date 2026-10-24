import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "../player-model";
import { headAngle, headPoint, sculptedHead } from "./head";

describe("continuous athlete head construction", () => {
  it("writes analytic normals once without an unused triangle-normal pass", () => {
    const look = lookFor("studio-fla-MF-1", "MF", true);
    const spy = vi.spyOn(THREE.BufferGeometry.prototype, "computeVertexNormals");
    const head = sculptedHead(proportionsFor(look), look.seed);
    try {
      expect(spy).not.toHaveBeenCalled();
      expect(head.getAttribute("position").count).toBe(137 * 103);
      expect(head.getIndex()!.count).toBe(136 * 102 * 6);
    } finally {
      head.dispose();
      spy.mockRestore();
    }
  });

  it.each(["studio-fla-MF-1", "orbital-depth-dark", "studio-flu-MF-1"])(
    "keeps scratch samples independent and normals attached across LODs: %s",
    (id) => {
      const look = lookFor(id, "MF", true);
      const P = proportionsFor(look);
      for (const detail of [false, true]) {
        const geometry = sculptedHead(P, look.seed, detail, false);
        try {
          const positions = geometry.getAttribute("position");
          const normals = geometry.getAttribute("normal");
          const uv = geometry.getAttribute("uv");
          for (let i = 0; i < positions.count; i += 11) {
            const height = positions.getY(i) / P.headR;
            const angle = headAngle(uv.getX(i));
            const point = headPoint(P, height, angle, look.seed);
            expect(
              new THREE.Vector3().fromBufferAttribute(positions, i).distanceTo(point),
            ).toBeLessThan(1e-7);
            const n = new THREE.Vector3().fromBufferAttribute(normals, i);
            expect(n.length()).toBeCloseTo(1, 5);
            // The derivative below independently allocates; aliasing either
            // construction scratch would flatten/flip the generated normals.
            const expected = headPoint(P, height, angle + 0.0005, look.seed)
              .sub(headPoint(P, height, angle - 0.0005, look.seed))
              .cross(
                headPoint(P, height + 0.0005, angle, look.seed).sub(
                  headPoint(P, height - 0.0005, angle, look.seed),
                ),
              )
              .normalize();
            expect(n.dot(expected)).toBeGreaterThan(0.9999);
          }
        } finally {
          geometry.dispose();
        }
      }
    },
  );
});
