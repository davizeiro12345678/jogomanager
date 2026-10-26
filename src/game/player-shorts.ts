import * as THREE from "three";
import type { Proportions } from "./player-model";

// One fitted envelope for cloth and its separate trim rings. Keep clearance
// over the quadriceps while avoiding inflated openings on lean athletes.
export const SHORTS_FIT = {
  crotchRadius: 1.34,
  hemWidth: 1.16,
  hemDepth: 1.25,
  allowance: 0.007,
} as const;

/** One garment: a continuous waist branches into two tailored openings.
 * The crotch is part of the topology rather than a capped pelvis plus two
 * oversized sleeves. Vertices below the seat are weighted to the legs. */
export function footballShorts(
  p: Pick<Proportions, "hipW" | "hipH" | "chestD" | "thigh" | "legR">,
  radial = 16,
  options?: { waistOnly?: boolean; waistRows?: number; legRows?: number },
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const openingLeg: number[] = [];
  const indices: number[] = [];
  const centers = p.hipW * 0.36;
  // The crotch closes between the legs, but its outer contour still has to
  // contain the quadriceps. A circle with radius equal to the joint spacing
  // was too narrow and let triangular patches of thigh pierce the garment.
  // Separate lateral tailoring from the deeper clearance needed when seated.
  const crotchRadius = (centers + p.legR * 1.18 + SHORTS_FIT.allowance) * 0.5;
  const top = p.hipH * 0.5;
  const crotch = -p.hipH * 0.73;
  const hem = -p.hipH * 0.4 - p.thigh * 0.49;
  const append = (x: number, y: number, z: number, u: number, leg = 0) => {
    positions.push(x, y, z);
    uvs.push(u, (y - hem) / (top - hem));
    openingLeg.push(leg);
  };
  const stitch = (a: number, b: number, count: number) => {
    for (let i = 0; i < count; i++)
      indices.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1);
  };
  const rows = options?.waistRows ?? 8;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    // Keep the waistband and upper seat one continuous volume. Branch only
    // below the pelvis so the front does not collapse between the thighs.
    const branchT = Math.max(0, (t - 0.5) / 0.5);
    const split = branchT * branchT * (3 - 2 * branchT);
    for (let i = 0; i <= radial * 2; i++) {
      const right = i > radial;
      const phase = ((right ? i - radial : i) / radial) * Math.PI * 2;
      const sign = right ? -1 : 1;
      // Keep room over the seat without the inflated mid-pelvis bulge that
      // made the front silhouette read as two cylindrical balloons. The
      // branch and opening still use the seated quadriceps coverage envelope.
      const xWaist = sign * Math.sin(phase / 2) * p.hipW * (0.62 + Math.sin(t * Math.PI) * 0.024);
      const zWaist = sign * Math.cos(phase / 2) * p.chestD * (0.87 + Math.sin(t * Math.PI) * 0.032);
      const xLeg = sign * crotchRadius * (1 - Math.cos(phase));
      const zLeg =
        sign * Math.sin(phase) * (p.legR * SHORTS_FIT.crotchRadius + SHORTS_FIT.allowance);
      append(
        xWaist + (xLeg - xWaist) * split,
        top + (crotch - top) * t,
        zWaist + (zLeg - zWaist) * split,
        i / (radial * 2),
      );
    }
    if (row) stitch((row - 1) * (radial * 2 + 1), row * (radial * 2 + 1), radial * 2);
  }
  const branch = rows * (radial * 2 + 1);
  for (const sign of options?.waistOnly ? [] : [1, -1]) {
    let previous = branch + (sign === 1 ? 0 : radial);
    const legRows = options?.legRows ?? 7;
    for (let row = 1; row <= legRows; row++) {
      const t = row / legRows;
      const y = crotch + (hem - crotch) * t;
      const center = crotchRadius + (centers - crotchRadius) * t;
      const width =
        crotchRadius * (1 - t) + (p.legR * SHORTS_FIT.hemWidth + SHORTS_FIT.allowance) * t;
      const depth =
        p.legR * (SHORTS_FIT.crotchRadius + t * (SHORTS_FIT.hemDepth - SHORTS_FIT.crotchRadius)) +
        SHORTS_FIT.allowance;
      const start = positions.length / 3;
      for (let i = 0; i <= radial; i++) {
        // Meet the thigh's sin/cos angular grid at the opening. A 90-degree
        // phase mismatch is harmless on dense rings, but six-sided extras
        // put skin corners directly behind cloth edges and looked torn when
        // seated. Blend from the crotch's authored grid without a new ring.
        const phase =
          (i / radial) * Math.PI * 2 + THREE.MathUtils.smoothstep(t, 0, 0.55) * Math.PI * 0.5;
        const hemRoll = Math.exp(-(((t - 0.97) / 0.07) ** 2)) * 0.0022;
        const panel = Math.cos(phase * 2) * Math.sin(Math.PI * t) * 0.001;
        const crease =
          Math.sin(phase * 5 + t * 4) * Math.sin(Math.PI * t) * 0.0018 + hemRoll + panel;
        append(
          sign * (center - Math.cos(phase) * (width + crease)),
          y,
          sign * Math.sin(phase) * (depth + crease),
          (sign === 1 ? 0 : 0.5) + i / (radial * 2),
          sign,
        );
      }
      stitch(previous, start, radial);
      previous = start;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  // Both openings cross the centre plane. Preserve their authored identity
  // until skinning, instead of assigning a femur from the vertex's x sign.
  geometry.setAttribute("openingLeg", new THREE.Float32BufferAttribute(openingLeg, 1));
  geometry.setIndex(indices);
  const color = new Float32Array(positions.length);
  const attributes = geometry.getAttribute("uv");
  for (let i = 0; i < attributes.count; i++) {
    const v = attributes.getY(i);
    const waistband = Math.exp(-(((v - 0.965) / 0.027) ** 2)) * 0.13;
    const hemShade = Math.exp(-(((v - 0.015) / 0.025) ** 2)) * 0.12;
    const panel = Math.exp(-((Math.cos(attributes.getX(i) * Math.PI * 4) / 0.07) ** 2)) * 0.055;
    color.set(
      [
        1 - waistband - hemShade - panel,
        1 - waistband - hemShade - panel,
        1 - waistband - hemShade - panel,
      ],
      i * 3,
    );
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  // Smooth duplicated UV seams, including the split at the crotch.
  const normal = geometry.getAttribute("normal");
  const seams = new Map<string, number[]>();
  for (let i = 0; i < positions.length / 3; i++) {
    const key = positions
      .slice(i * 3, i * 3 + 3)
      .map((v) => Math.round(v * 1e6))
      .join(",");
    const list = seams.get(key);
    if (list) list.push(i);
    else seams.set(key, [i]);
  }
  const n = new THREE.Vector3();
  for (const list of seams.values()) {
    if (list.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of list) n.add(new THREE.Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)));
    n.normalize();
    for (const i of list) normal.setXYZ(i, n.x, n.y, n.z);
  }
  return geometry;
}
