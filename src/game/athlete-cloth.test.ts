import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AthleteCloth, ClothDynamics, type ClothMotion } from "./athlete-cloth";
import { lookFor, proportionsFor } from "./player-model";
import { playerMaterials } from "./player-materials";
import { buildRigSkin } from "./rig-skin";
import { eyelidSurface } from "./player-sculpt";

const still: ClothMotion = { x: 0, z: 0, lift: 0, effort: 0, bend: 0 };
const kit = {
  base: "#bf1736",
  detail: "#fff",
  shorts: "#1a1c22",
  socks: "#bf1736",
  pattern: "solid",
} as const;

describe("bounded athlete garment mechanics", () => {
  it("reserves the impact fold for ground contact instead of airborne descent", () => {
    const cloth = new ClothDynamics();
    cloth.advance(1 / 60, { ...still, lift: .5 });
    cloth.advance(1 / 60, { ...still, lift: .3 });
    expect(cloth.impact).toBe(0);
    cloth.advance(1 / 60, still);
    expect(cloth.impact).toBeGreaterThan(0);
  });
  it("responds with inertia and settles after acceleration and landing", () => {
    const cloth = new ClothDynamics();
    cloth.advance(1 / 60, still);
    for (let i = 0; i < 60; i++)
      cloth.advance(1 / 60, { ...still, z: (8 * i) / 60, lift: i < 30 ? 0.5 : 0 });
    expect(Math.abs(cloth.offset[1]!)).toBeGreaterThan(0.001);
    for (let i = 0; i < 240; i++) cloth.advance(1 / 60, still);
    expect(Math.abs(cloth.offset[0]!) + Math.abs(cloth.offset[1]!)).toBeLessThan(0.00002);
    expect(cloth.impact).toBeLessThan(0.00002);
  });
  it("transfers small turns into bounded cloth inertia across the heading wrap", () => {
    const turned = (start: number, end: number) => {
      const cloth = new ClothDynamics();
      cloth.advance(1 / 60, { ...still, yaw: start });
      cloth.advance(1 / 60, { ...still, yaw: end });
      return cloth;
    };
    const direct = turned(0, 0.08);
    const wrapped = turned(Math.PI - 0.04, -Math.PI + 0.04);
    expect(wrapped.turnRate).toBeCloseTo(direct.turnRate, 5);
    expect(wrapped.offset[0]).toBeCloseTo(direct.offset[0]!, 6);
    expect(Math.abs(wrapped.offset[0]!)).toBeGreaterThan(0);
    for (let i = 0; i < 180; i++)
      wrapped.advance(1 / 60, { ...still, yaw: -Math.PI + 0.04, roll: 0.6 });
    expect(Math.abs(wrapped.offset[0]!)).toBeLessThanOrEqual(0.021);
    expect(Math.abs(wrapped.offset[1]!)).toBeLessThanOrEqual(0.021);
    expect(Number.isFinite(wrapped.rollRate)).toBe(true);
  });
  it("freezes with pause and survives long frames and invalid external motion", () => {
    const cloth = new ClothDynamics();
    for (let i = 0; i < 60; i++) cloth.advance(1 / 60, { ...still, x: 6, z: 4 });
    const before = [...cloth.offset],
      time = cloth.time;
    cloth.advance(0, { ...still, x: -15, z: -15, lift: 4 });
    expect([...cloth.offset]).toEqual(before);
    expect(cloth.time).toBe(time);
    for (let i = 0; i < 80; i++) cloth.advance(10, { ...still, x: NaN, z: Infinity, lift: NaN });
    expect([...cloth.offset].every(Number.isFinite)).toBe(true);
    expect(Math.max(...Array.from(cloth.offset, Math.abs))).toBeLessThanOrEqual(0.021);
  });
  it("keeps the damped response comparable at 30, 60 and 120 frames per second", () => {
    const results = [30, 60, 120].map((fps) => {
      const cloth = new ClothDynamics();
      for (let i = 0; i < fps * 2; i++)
        cloth.advance(1 / fps, { ...still, z: Math.min(8, (i / fps) * 4) });
      return cloth.offset[1]!;
    });
    expect(Math.max(...results) - Math.min(...results)).toBeLessThan(0.0004);
  });
  it("pins collar and waist and adds no bones or material groups", () => {
    const look = lookFor("cloth-athlete", "MF"),
      p = proportionsFor(look),
      mats = playerMaterials(look, kit, null, "alta");
    const skin = buildRigSkin(
      {
        P: p,
        look,
        mats,
        hi: true,
        segs: { radial: 16, cap: 4 },
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#fff",
      },
      [0, 0, 0],
    );
    const groups = skin.groups.length,
      bones = skin.bones.length;
    const cloth = new AthleteCloth(skin, p);
    let pinned = 0,
      moving = 0;
    for (const group of skin.groups) {
      const morphs = group.geometry.morphAttributes.position;
      if (!morphs?.length) continue;
      expect(morphs.length).toBe(5);
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      cloth.bind(mesh);
      const position = group.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        const anchor =
          group.materialKey === "shorts"
            ? y >= p.hipY + p.hipH * 0.2
            : y >= p.hipY + p.hipH * 0.5 + p.spineLen + p.chestLen * 0.9;
        for (const morph of morphs) {
          const distance = Math.hypot(morph.getX(i), morph.getY(i), morph.getZ(i));
          expect(Number.isFinite(distance)).toBe(true);
          expect(distance).toBeLessThan(0.018);
          if (anchor) {
            expect(distance).toBe(0);
            pinned++;
          } else if (distance > 0.0002) moving++;
        }
      }
      cloth.update(1 / 60, { ...still, z: 8, bend: 1 });
      expect(mesh.morphTargetInfluences!.every((v) => v >= 0 && v <= 1)).toBe(true);
      const relaxedFold = mesh.morphTargetInfluences![4]!;
      cloth.update(1 / 60, { ...still, z: 8, bend: 1, yaw: Math.PI / 2, roll: 0.2 });
      expect(mesh.morphTargetInfluences![4]!).toBeGreaterThan(relaxedFold);
      expect(mesh.morphTargetInfluences!.every((v) => v >= 0 && v <= 1)).toBe(true);
    }
    expect(pinned).toBeGreaterThan(20);
    expect(moving).toBeGreaterThan(100);
    expect(skin.groups.length).toBe(groups);
    expect(skin.bones.length).toBe(bones);
    skin.dispose();
  });
  it("preserves the inexpensive distant garment path", () => {
    const look = lookFor("cloth-low", "MF"),
      p = proportionsFor(look),
      mats = playerMaterials(look, kit, null, "media");
    const skin = buildRigSkin(
      {
        P: p,
        look,
        mats,
        hi: false,
        segs: { radial: 8, cap: 3 },
        handR: p.handR,
        handMat: mats.skin,
        jerseyInk: "#fff",
      },
      [0, 0, 0],
    );
    new AthleteCloth(skin, p, false);
    expect(skin.groups.every((g) => !g.geometry.morphAttributes.position?.length)).toBe(true);
    skin.dispose();
  });
  it("faces both upper and lower orbital surfaces toward the camera", () => {
    const p = proportionsFor(lookFor("eyelids-realism", "MF"));
    for (const side of [-1, 1])
      for (const upper of [true, false]) {
        const lid = eyelidSurface(p, side, 17, upper),
          normal = lid.getAttribute("normal");
        for (let row = 0; row < 5; row++)
          for (let col = 3; col < 22; col++)
            expect(normal.getZ(row * 25 + col)).toBeGreaterThan(0.1);
        lid.dispose();
      }
  });
});
