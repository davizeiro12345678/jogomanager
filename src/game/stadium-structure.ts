import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Closed steel box sections, authored in metres and baked into one draw.
 * Cantilevers terminate over the front rows; their rear columns meet the
 * ground instead of hanging several metres above the terrace. */
export function stadiumRoofStructure(rings: number, fieldX: number, fieldZ: number) {
  const pieces: THREE.BufferGeometry[] = [];
  const outer = 9 + rings * 1.5;
  const terrace = 2 + rings * 1.45;
  const roof = terrace + 7;
  const up = new THREE.Vector3(0, 1, 0);
  const beam = (a: THREE.Vector3, b: THREE.Vector3, thickness: number) => {
    const delta = b.clone().sub(a);
    const geometry = new THREE.BoxGeometry(thickness, delta.length(), thickness);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()));
    geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    pieces.push(geometry);
  };
  const truss = (along: number, sign: number, endStand: boolean) => {
    const point = (across: number, y: number) =>
      endStand
        ? new THREE.Vector3(sign * (fieldX + outer + across), y, along)
        : new THREE.Vector3(along, y, sign * (fieldZ + outer + across));
    const rear = point(3.5, roof - 0.6);
    const lower = point(3.5, roof - 2.7);
    const tip = point(-2, roof - 0.6);
    beam(point(3.5, 0), rear, 0.34);
    beam(rear, tip, 0.18);
    beam(lower, tip, 0.18);
    // The intermediate vertical and two triangles transmit the cantilever load.
    const middleTop = point(0.7, roof - 0.6);
    const middleBottom = point(0.7, roof - 1.6);
    beam(middleTop, middleBottom, 0.12);
    beam(lower, middleTop, 0.12);
    beam(rear, middleBottom, 0.12);
  };
  for (const sign of [-1, 1]) {
    for (let i = -5; i <= 5; i++) truss((i * (fieldX * 2 + 20)) / 10, sign, false);
    for (let i = -3; i <= 3; i++) truss((i * (fieldZ * 2 + 14)) / 6, sign, true);
    beam(
      new THREE.Vector3(-fieldX - 10, roof - 0.6, sign * (fieldZ + outer - 2)),
      new THREE.Vector3(fieldX + 10, roof - 0.6, sign * (fieldZ + outer - 2)),
      0.14,
    );
    beam(
      new THREE.Vector3(sign * (fieldX + outer - 2), roof - 0.6, -fieldZ - 7),
      new THREE.Vector3(sign * (fieldX + outer - 2), roof - 0.6, fieldZ + 7),
      0.14,
    );
  }
  const geometry = mergeGeometries(pieces, false)!;
  pieces.forEach((piece) => piece.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Six stair risers per terrace row. This is also the seat exclusion
 * contract, so an aisle never intersects the spectator's chair plane. */
export const STADIUM_AISLE_WIDTH = 1.1;
export const STADIUM_STAIR_SUBSTEPS = 6;
export function stadiumAisleCenters(fieldX: number) {
  return [-2, -1, 0, 1, 2].map((sector) => (sector * (fieldX * 2 + 30)) / 6);
}

export function stadiumSeatFront(width: number, height: number, aisleCenters: number[]) {
  const pieces: THREE.BufferGeometry[] = [];
  let start = -width / 2;
  for (const center of [...aisleCenters, width / 2 + STADIUM_AISLE_WIDTH / 2]) {
    const end = center - STADIUM_AISLE_WIDTH / 2;
    if (end > start) {
      const panel = new THREE.PlaneGeometry(end - start, height);
      panel.translate((start + end) / 2, 0, 0);
      const uv = panel.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setX(i, (start + width / 2 + uv.getX(i) * (end - start)) / width);
      pieces.push(panel);
    }
    start = center + STADIUM_AISLE_WIDTH / 2;
  }
  const geometry = mergeGeometries(pieces, false)!;
  pieces.forEach((piece) => piece.dispose());
  geometry.computeBoundingBox();
  return geometry;
}
