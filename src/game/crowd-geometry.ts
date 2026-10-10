import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Region IDs let skin and hair retain their own colour under team-coloured
 * instance jerseys. Arms, shoes and a scarf share the same single draw. */
export function supporterGeometry(detailed: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const radial = detailed ? 8 : 4;
  const part = (
    geometry: THREE.BufferGeometry,
    region: number,
    x: number,
    y: number,
    z = 0,
    rotation = 0,
    limb = 0,
    side = 0,
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
    const motion = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      motion[i * 2] = side;
      motion[i * 2 + 1] = limb;
    }
    geometry.setAttribute("crowdLimb", new THREE.Float32BufferAttribute(motion, 2));
    parts.push(geometry);
  };
  // A fitted torso has a waist, ribcage, shoulders and neckline. The medium
  // tier retains its original 60-triangle cap for the bulk of the grandstand.
  const torso = detailed
    ? new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.155, -0.275),
          new THREE.Vector2(0.153, -0.2),
          new THREE.Vector2(0.169, -0.04),
          new THREE.Vector2(0.193, 0.13),
          new THREE.Vector2(0.207, 0.22),
          new THREE.Vector2(0.17, 0.275),
          new THREE.Vector2(0.065, 0.3),
        ],
        radial,
      )
    : new THREE.CylinderGeometry(0.205, 0.155, 0.55, radial, 1, true);
  if (detailed) torso.scale(1, 1, 0.65);
  part(torso, 0, 0, 0.03);
  const head = new THREE.SphereGeometry(0.145, radial, detailed ? 5 : 3);
  head.scale(0.91, 1.13, 0.93);
  if (detailed) {
    const p = head.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 0.164,
        z = p.getZ(i);
      // Flatten the temples and taper an adult jaw instead of a round bead.
      p.setX(i, p.getX(i) * (y < -0.15 ? 0.8 + (y + 1) * 0.17 : 1));
      if (z > 0) p.setZ(i, z + 0.012 * Math.exp(-(((y + 0.4) / 0.28) ** 2)));
    }
    head.computeVertexNormals();
  }
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
    const nose = new THREE.SphereGeometry(0.022, 5, 3);
    nose.scale(0.65, 1.2, 1.5);
    part(nose, 1, 0, 0.477, 0.147);
    for (const side of [-1, 1]) {
      const ear = new THREE.SphereGeometry(0.025, 5, 3);
      ear.scale(0.5, 1.15, 0.8);
      part(ear, 1, side * 0.132, 0.475, 0.005);
      const eye = new THREE.SphereGeometry(0.009, 4, 3);
      eye.scale(1, 0.55, 0.4);
      part(eye, 3, side * 0.052, 0.515, 0.124);
    }
  }
  for (const side of [-1, 1]) {
    part(
      detailed
        ? new THREE.CylinderGeometry(0.06, 0.052, 0.23, radial)
        : new THREE.PlaneGeometry(0.09, 0.38),
      0,
      side * (detailed ? 0.23 : 0.24),
      detailed ? 0.137 : 0.035,
      0,
      side * 0.17,
      1,
      side,
    );
    if (detailed) {
      part(
        new THREE.CylinderGeometry(0.051, 0.041, 0.21, radial),
        1,
        side * 0.263,
        -0.08,
        0,
        side * 0.17,
        2,
        side,
      );
      part(new THREE.SphereGeometry(0.049, 5, 3), 1, side * 0.28, -0.2, 0.01, 0, 2, side);
    }
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
