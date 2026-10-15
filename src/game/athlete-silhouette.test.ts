import { expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, lookWithPhysique, proportionsFor } from "./player-model";
import { footballShorts } from "./player-shorts";
import { footballBoot, shoulderSleeve } from "./rig-geometry";
import { FINGER_CENTERS_Y, FINGER_LENGTHS } from "./player-hands";
import { sculptedHair } from "./player-sculpt";

it("keeps the upper shorts front and seat continuous instead of a deep centre cleft", () => {
  for (const weight of [55, 78, 110]) {
    const p = proportionsFor(
      lookWithPhysique(lookFor("front-seat-panel", "MF"), { height: 183, weight }),
    );
    const geometry = footballShorts(p, 16);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    for (const direction of [-1, 1])
      for (const y of [0, -p.hipH * 0.25]) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(0, y, direction),
          new THREE.Vector3(0, 0, -direction),
        );
        const hit = ray.intersectObject(mesh)[0];
        expect(hit).toBeDefined();
        expect(Math.abs(hit!.point.z)).toBeGreaterThan(p.chestD * 0.6);
      }
    geometry.dispose();
    material.dispose();
  }
});

it("rolls mirrored shoulder domes into the torso above their pivot without separate muscle parts", () => {
  const p = proportionsFor(lookFor("shoulder-silhouette", "MF"));
  for (const side of [-1, 1]) {
    const cap = shoulderSleeve(p.upperArm, p.armR, 16, side);
    cap.computeBoundingBox();
    const top = cap.boundingBox!.max.y;
    expect(top).toBeGreaterThan(p.armR * 0.3);
    const positions = cap.getAttribute("position");
    let sum = 0,
      count = 0;
    for (let i = 0; i < positions.count; i++)
      if (positions.getY(i) >= top - 1e-6) {
        sum += positions.getX(i);
        count++;
      }
    expect((side * sum) / count).toBeLessThan(-p.armR * 0.2);
    expect(cap.groups).toHaveLength(0);
    expect(Array.from(cap.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    cap.dispose();
  }
});

it("gives adult fingers and boot instep readable volume without changing sole contact height", () => {
  const p = proportionsFor(lookFor("hand-boot-silhouette", "MF"));
  const handLength = p.handR * (FINGER_CENTERS_Y[1] + FINGER_LENGTHS[1] * 0.5);
  expect(handLength / (p.upperArm + p.foreArm)).toBeGreaterThan(0.25);
  expect(handLength / (p.upperArm + p.foreArm)).toBeLessThan(0.35);
  const upper = footballBoot(p.footLen, p.footH, 16);
  const sole = footballBoot(p.footLen, p.footH, 16, true);
  upper.computeBoundingBox();
  sole.computeBoundingBox();
  expect(upper.boundingBox!.max.x - upper.boundingBox!.min.x).toBeGreaterThan(p.footH * 1.35);
  expect(upper.boundingBox!.max.y - upper.boundingBox!.min.y).toBeGreaterThan(p.footH * 0.85);
  expect(upper.boundingBox!.min.y).toBeGreaterThan(sole.boundingBox!.min.y - 0.001);
  upper.dispose();
  sole.dispose();
});

it("keeps high-detail hair locks in one colored surface while distant hair remains merge-compatible", () => {
  const look = { ...lookFor("hair-lock-silhouette", "MF"), hairStyle: "short" as const };
  const p = proportionsFor(look);
  const detailed = sculptedHair(p, look, true);
  const distant = sculptedHair(p, look, false);
  expect(detailed.groups).toHaveLength(0);
  expect(detailed.getAttribute("color").count).toBe(detailed.getAttribute("position").count);
  expect(Math.min(...Array.from(detailed.getAttribute("color").array))).toBeLessThan(0.85);
  expect(distant.hasAttribute("color")).toBe(false);
  detailed.dispose();
  distant.dispose();
});
