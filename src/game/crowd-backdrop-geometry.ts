import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FIELD_X, FIELD_Z } from "./sim-rules";

/** The four original raked panels, with their original repeated UVs, share
 * one immutable surface. No spectators, sectors or texture pixels are removed. */
export function crowdBackdropRing(rings: number) {
  const height = Math.max(9, rings * 1.45 + 0.6),
    depth = rings * 1.5;
  const y = 3.2 + height * 0.5;
  const panels: THREE.BufferGeometry[] = [];
  for (const axis of ["z", "x"] as const) {
    const width = axis === "z" ? FIELD_X * 2 + 24 : FIELD_Z * 2 + 18;
    const edge = axis === "z" ? FIELD_Z + 6.5 + depth * 0.5 : FIELD_X + 9.5 + depth * 0.5;
    for (const side of [-1, 1]) {
      const panel = new THREE.PlaneGeometry(width, height);
      const position = panel.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < position.count; i++)
        position.setZ(i, (position.getY(i) * depth) / height);
      panel.computeVertexNormals();
      const uv = panel.getAttribute("uv") as THREE.BufferAttribute;
      const repeat = Math.max(1, Math.round(width / height / (1024 / 320)));
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * repeat);
      panel.rotateY(axis === "z" ? (side > 0 ? 0 : Math.PI) : (side * Math.PI) / 2);
      panel.translate(axis === "x" ? side * edge : 0, y, axis === "z" ? side * edge : 0);
      panels.push(panel);
    }
  }
  const geometry = mergeGeometries(panels)!;
  panels.forEach((panel) => panel.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
