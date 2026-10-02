import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Region IDs let skin and hair retain their own colour under team-coloured
 * instance jerseys. Arms, shoes and a scarf share the same single draw. */
export function supporterGeometry(detailed: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const radial = detailed ? 7 : 4;
  const part = (
    geometry: THREE.BufferGeometry,
    region: number,
    x: number,
    y: number,
    z = 0,
    rotation = 0,
  ) => {
    geometry.rotateZ(rotation);
    geometry.translate(x, y, z);
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3),
    );
    geometry.setAttribute(
      "crowdRegion",
      new THREE.Float32BufferAttribute(new Float32Array(count).fill(region), 1),
    );
    parts.push(geometry);
  };
  part(new THREE.CylinderGeometry(0.205, 0.155, 0.55, radial, 1, !detailed), 0, 0, 0.03);
  const head = new THREE.SphereGeometry(0.145, radial, detailed ? 5 : 3);
  head.scale(0.91, 1.13, 0.93);
  part(head, 1, 0, 0.48, 0.015);
  if (detailed) {
    part(
      new THREE.SphereGeometry(0.147, radial, 3, 0, Math.PI * 2, 0, Math.PI * 0.48),
      3,
      0,
      0.51,
      0.006,
    );
    part(new THREE.BoxGeometry(0.38, 0.065, 0.32), 4, 0, 0.265, 0.01);
  }
  for (const side of [-1, 1]) {
    part(
      detailed
        ? new THREE.CylinderGeometry(0.06, 0.047, 0.38, radial)
        : new THREE.PlaneGeometry(0.09, 0.38),
      0,
      side * 0.24,
      0.035,
      0,
      side * 0.17,
    );
    if (detailed) part(new THREE.SphereGeometry(0.054, 5, 3), 1, side * 0.275, -0.17, 0.01);
    part(
      new THREE.CylinderGeometry(0.077, 0.057, 0.5, detailed ? radial : 3, 1, !detailed),
      2,
      side * 0.095,
      -0.5,
    );
    if (detailed) part(new THREE.BoxGeometry(0.12, 0.075, 0.23), 3, side * 0.095, -0.79, 0.03);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((geometry) => geometry.dispose());
  merged.computeBoundingSphere();
  return merged;
}
