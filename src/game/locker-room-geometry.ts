import * as THREE from "three";

/** One shared open cabinet frame replaces the nine closed boxes in the set.
 * The existing rear wall remains visible through the recess: no extra back
 * panel, light, material group or transparent surface is needed. */
export function buildLockerFrame(): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  outline.moveTo(-0.71, -1.3);
  outline.lineTo(0.71, -1.3);
  outline.lineTo(0.71, 1.3);
  outline.lineTo(-0.71, 1.3);
  outline.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-0.59, -1.08);
  opening.lineTo(-0.59, 1.08);
  opening.lineTo(0.59, 1.08);
  opening.lineTo(0.59, -1.08);
  opening.closePath();
  outline.holes.push(opening);
  const frame = new THREE.ExtrudeGeometry(outline, {
    depth: 0.62,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 1,
  });
  frame.translate(0, 0, -0.31);
  // One material domain keeps all nine frames eligible for the existing
  // static cinematic batch, despite the front and side extrusion groups.
  frame.clearGroups();
  frame.computeBoundingBox();
  frame.computeBoundingSphere();
  return frame;
}
