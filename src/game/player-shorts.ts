import * as THREE from "three";
import type { Proportions } from "./player-model";

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
  const indices: number[] = [];
  const centers = p.hipW * 0.36;
  // The crotch closes between the legs, but its outer contour still has to
  // contain the quadriceps. A circle with radius equal to the joint spacing
  // was too narrow and let triangular patches of thigh pierce the garment.
  const crotchRadius = (centers + p.legR * 1.34 + 0.01) * 0.5;
  const top = p.hipH * 0.5;
  const crotch = -p.hipH * 0.73;
  const hem = -p.hipH * 0.4 - p.thigh * 0.49;
  const append = (x: number, y: number, z: number, u: number) => {
    positions.push(x, y, z);
    uvs.push(u, (y - hem) / (top - hem));
  };
  const stitch = (a: number, b: number, count: number) => {
    for (let i = 0; i < count; i++)
      indices.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1);
  };
  const rows = options?.waistRows ?? 6;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const split = t * t * (3 - 2 * t);
    for (let i = 0; i <= radial * 2; i++) {
      const right = i > radial;
      const phase = ((right ? i - radial : i) / radial) * Math.PI * 2;
      const sign = right ? -1 : 1;
      const xWaist = sign * Math.sin(phase / 2) * p.hipW * (0.62 + Math.sin(t * Math.PI) * 0.065);
      const zWaist = sign * Math.cos(phase / 2) * p.chestD * (0.87 + Math.sin(t * Math.PI) * 0.08);
      const xLeg = sign * crotchRadius * (1 - Math.cos(phase));
      const zLeg = sign * Math.sin(phase) * (p.legR * 1.34 + 0.007);
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
    const legRows = options?.legRows ?? 5;
    for (let row = 1; row <= legRows; row++) {
      const t = row / legRows;
      const y = crotch + (hem - crotch) * t;
      const center = crotchRadius + (centers - crotchRadius) * t;
      const width = crotchRadius * (1 - t) + (p.legR * 1.2 + 0.007) * t;
      const depth = p.legR * (1.34 - t * 0.05) + 0.007;
      const start = positions.length / 3;
      for (let i = 0; i <= radial; i++) {
        const phase = (i / radial) * Math.PI * 2;
        const crease = Math.sin(phase * 5 + t * 4) * Math.sin(Math.PI * t) * 0.0012;
        append(
          sign * (center - Math.cos(phase) * (width + crease)),
          y,
          sign * Math.sin(phase) * (depth + crease),
          (sign === 1 ? 0 : 0.5) + i / (radial * 2),
        );
      }
      stitch(previous, start, radial);
      previous = start;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
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
