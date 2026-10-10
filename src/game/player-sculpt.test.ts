import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  anatomicalLimb,
  anatomicalSection,
  footballBoot,
  neckSurface,
  palmSurface,
} from "./rig-geometry";
import { buildRigSkin, countRigSkin } from "./rig-skin";
import { HERO_MESH_COST } from "./draw-budget";
import { lookFor, proportionsFor, type HairStyle } from "./player-model";
import { faceMorphology, skinAlbedo } from "./player-morphology";
import { playerMaterials } from "./player-materials";
import { beardAlbedo } from "./rig-materials";
import {
  buildSculptedFace,
  eyelidSurface,
  faceSurfaceZ,
  headPoint,
  lipPatch,
  sculptedHair,
  sculptedHead,
  sculptedBeard,
  sculptedMoustache,
} from "./player-sculpt";

const kit = {
  base: "#af1830",
  detail: "#15191f",
  pattern: "hoops",
  shorts: "#eee",
  socks: "#171b20",
} as const;
const look = lookFor("studio-fla-MF-1", "MF", true);
const P = proportionsFor(look);

describe("sculpted football player", () => {
  it("occludes the adult iris arcs with the relaxed orbital lids across seeded faces", () => {
    const material = new THREE.MeshBasicMaterial();
    for (const id of [
      "studio-fla-MF-1",
      "studio-flu-MF-1",
      "orbital-depth-light",
      "orbital-depth-dark",
    ]) {
      const athlete = lookFor(id, "MF", true),
        p = proportionsFor(athlete),
        morphology = faceMorphology(athlete.seed);
      const face = buildSculptedFace(p, athlete, playerMaterials(athlete, kit, null, "alta"), true);
      for (const side of [-1, 1]) {
        const iris = new THREE.Mesh(face.eyes[side < 0 ? 0 : 4]!.geometry, material);
        iris.updateMatrixWorld(true);
        const x = side * p.headW * morphology.eyeSpacing,
          y = p.headR * (0.14 + side * morphology.eyeAsymmetry);
        for (const upper of [true, false]) {
          const lid = new THREE.Mesh(eyelidSurface(p, side, athlete.seed, upper), material);
          lid.updateMatrixWorld(true);
          const probeY = y + p.headR * (upper ? 0.054 : -0.0565);
          const ray = new THREE.Raycaster(
            new THREE.Vector3(x, probeY, 1),
            new THREE.Vector3(0, 0, -1),
          );
          const irisHit = ray.intersectObject(iris)[0],
            lidHit = ray.intersectObject(lid)[0];
          expect(irisHit).toBeDefined();
          expect(lidHit).toBeDefined();
          expect(lidHit!.distance).toBeLessThan(irisHit!.distance);
          lid.geometry.dispose();
        }
      }
      for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
    }
    material.dispose();
  });

  it("fits moustache growth against the upper lip without a projected circular tube", () => {
    for (const detail of [true, false]) {
      const geometry = sculptedMoustache(P, { ...look, beard: "full" }, detail),
        positions = geometry.getAttribute("position"),
        normals = geometry.getAttribute("normal");
      // The former 14-by-5 tube cost 140 triangles, even at the light tier.
      expect(geometry.index!.count).toBeLessThan(140 * 3);
      expect(geometry.groups).toHaveLength(0);
      const uv = geometry.getAttribute("uv");
      const heights = new Map<number, { low: number; high: number }>();
      for (let i = 0; i < positions.count; i++) {
        const projection =
          positions.getZ(i) - faceSurfaceZ(P, positions.getX(i), positions.getY(i), look.seed);
        expect(projection).toBeGreaterThan(0);
        expect(projection).toBeLessThan(P.headR * 0.018);
        expect(positions.getY(i)).toBeGreaterThan(-P.headR * 0.455);
        expect(positions.getY(i)).toBeLessThan(-P.headR * 0.32);
        expect(normals.getZ(i)).toBeGreaterThan(0.1);
        const u = uv.getX(i),
          y = positions.getY(i);
        const extent = heights.get(u) ?? { low: Infinity, high: -Infinity };
        extent.low = Math.min(extent.low, y);
        extent.high = Math.max(extent.high, y);
        heights.set(u, extent);
      }
      const maximumHeight = Math.max(
        ...Array.from(heights.values(), (extent) => extent.high - extent.low),
      );
      for (const u of [0, 1]) {
        const tip = heights.get(u)!;
        expect(tip.high - tip.low).toBeLessThan(maximumHeight * 0.15);
      }
      const philtrum = heights.get(0.5)!;
      expect(philtrum.high - philtrum.low).toBeLessThan(maximumHeight * 0.65);
      geometry.dispose();
    }
  });

  it("settles the lips into the face with warm pigment and the skull's skin-map coordinates", () => {
    for (const id of [
      "studio-fla-MF-1",
      "studio-flu-MF-1",
      "orbital-depth-light",
      "orbital-depth-dark",
    ]) {
      const athlete = lookFor(id, "MF", true),
        p = proportionsFor(athlete);
      for (const lower of [false, true]) {
        const geometry = lipPatch(p, athlete.seed, lower),
          positions = geometry.getAttribute("position"),
          uv = geometry.getAttribute("uv"),
          colors = geometry.getAttribute("color");
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i),
            y = positions.getY(i);
          const projection = positions.getZ(i) - faceSurfaceZ(p, x, y, athlete.seed);
          expect(projection).toBeGreaterThan(0);
          expect(projection).toBeLessThan(p.headR * 0.017);
          if (i >= 6 * 25) {
            expect(projection).toBeCloseTo(p.headR * 0.0008, 7);
            expect(colors.getX(i)).toBeCloseTo(1, 7);
            expect(colors.getY(i)).toBeCloseTo(1, 7);
            expect(colors.getZ(i)).toBeCloseTo(1, 7);
          }
          // Reconstruct the head sample from its authored nonuniform UV grid.
          // This verifies the attached lip samples pores/roughness at the same
          // scale and position rather than stretching a full atlas per lip.
          const theta = uv.getX(i) * Math.PI * 2;
          const angle = theta - Math.sin(theta) * 0.6;
          const centered = uv.getY(i) * 2 - 1;
          const height = centered * (0.7 + centered * centered * 0.3) * 1.14;
          const skull = headPoint(p, height, angle, athlete.seed);
          expect(skull.x).toBeCloseTo(x, 6);
          expect(skull.y).toBeCloseTo(y, 6);
        }
        const inner = 2 * 25 + 12;
        expect(colors.getY(inner)).toBeLessThan(colors.getX(inner) * 0.8);
        // Signed U changes continuously across the philtrum, with no 0/1 jump.
        for (let row = 0; row <= 6; row++) {
          for (let column = 1; column <= 24; column++) {
            expect(
              Math.abs(uv.getX(row * 25 + column) - uv.getX(row * 25 + column - 1)),
            ).toBeLessThan(0.03);
          }
        }
        geometry.dispose();
      }
    }
  });

  it("keeps beard growth below the lower lip and blends its edge into the rendered skin albedo", () => {
    for (const skin of ["#efd0b0", "#3f281e"]) {
      const athlete = { ...look, skin, hairColor: "#14120f", beard: "full" as const };
      const geometry = sculptedBeard(P, athlete),
        positions = geometry.getAttribute("position"),
        uv = geometry.getAttribute("uv"),
        colors = geometry.getAttribute("color");
      const tone = beardAlbedo(skin, athlete.hairColor, athlete.beard),
        complexion = new THREE.Color(skinAlbedo(skin));
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(positions.getX(i)) < P.headR * 0.035)
          expect(positions.getY(i)).toBeLessThan(-P.headR * 0.57);
        if (uv.getY(i) === 1) {
          expect(colors.getX(i) * tone.r).toBeCloseTo(complexion.r, 6);
          expect(colors.getY(i) * tone.g).toBeCloseTo(complexion.g, 6);
          expect(colors.getZ(i) * tone.b).toBeCloseTo(complexion.b, 6);
        }
      }
      geometry.dispose();
    }
  });

  it("keeps the iris edge above the sclera and the pupil above the cornea", () => {
    for (const id of [
      "studio-fla-MF-1",
      "studio-flu-MF-1",
      "orbital-depth-light",
      "orbital-depth-dark",
    ]) {
      const athlete = lookFor(id, "MF", true),
        p = proportionsFor(athlete);
      const face = buildSculptedFace(p, athlete, playerMaterials(athlete, kit, null, "alta"), true);
      for (const offset of [0, 4]) {
        const iris = face.eyes[offset]!,
          pupil = face.eyes[offset + 2]!;
        const points = iris.geometry.getAttribute("position");
        let lowest = Infinity,
          highest = -Infinity;
        for (let i = 0; i < points.count; i++) {
          const depth =
            points.getZ(i) - faceSurfaceZ(p, points.getX(i), points.getY(i), athlete.seed);
          lowest = Math.min(lowest, depth);
          highest = Math.max(highest, depth);
        }
        // Peripheral cornea is recessed under the lids; the visible centre
        // clears the sclera. Lid occlusion is checked with rays above.
        expect(lowest).toBeGreaterThan(0);
        expect(highest).toBeGreaterThan(p.headR * 0.03);
        const pupilCentre = new THREE.Vector3().setFromMatrixPosition(pupil.matrix);
        expect(
          pupilCentre.z - faceSurfaceZ(p, pupilCentre.x, pupilCentre.y, athlete.seed),
        ).toBeGreaterThan(highest);
        const pupilPoints = pupil.geometry.getAttribute("position");
        for (let i = 0; i < pupilPoints.count; i++) {
          const point = new THREE.Vector3()
            .fromBufferAttribute(pupilPoints, i)
            .applyMatrix4(pupil.matrix);
          expect(point.z - faceSurfaceZ(p, point.x, point.y, athlete.seed)).toBeGreaterThan(
            highest,
          );
        }
      }
      for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
    }
  });
  it("gives the two boot uppers mirrored medial arches while retaining the contact sole", () => {
    const left = footballBoot(P.footLen, P.footH, 16, false, undefined, 1);
    const right = footballBoot(P.footLen, P.footH, 16, false, undefined, -1);
    const leftSole = footballBoot(P.footLen, P.footH, 16, true, undefined, 1);
    const rightSole = footballBoot(P.footLen, P.footH, 16, true, undefined, -1);
    const a = left.getAttribute("position"),
      b = right.getAttribute("position");
    expect(a.count).toBe(b.count);
    let handed = 0;
    for (let i = 0; i < a.count; i++) {
      expect(a.getY(i)).toBe(b.getY(i));
      expect(a.getZ(i)).toBe(b.getZ(i));
      handed = Math.max(handed, Math.abs(a.getX(i) - b.getX(i)));
    }
    expect(handed).toBeGreaterThan(P.footH * 0.025);
    expect(leftSole.getAttribute("position").array).toEqual(
      rightSole.getAttribute("position").array,
    );
    for (const geometry of [left, right, leftSole, rightSole]) {
      expect(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
  });
  it("keeps both lip surfaces facing outward so the lower lip survives backface culling", () => {
    for (const lower of [false, true]) {
      const geometry = lipPatch(P, look.seed, lower);
      const normals = geometry.getAttribute("normal");
      let forward = 0;
      for (let i = 0; i < normals.count; i++) forward += normals.getZ(i);
      expect(forward / normals.count).toBeGreaterThan(0.2);
      expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
  });
  it("retains formal shirt and lapels when merging the staff costume into the animated rig", () => {
    const base = playerMaterials(look, kit, null, "alta");
    const mats = { ...base, trim: base.bootAccent };
    const context = {
      P,
      look,
      mats,
      hi: true,
      segs: { radial: 16, cap: 4 },
      handR: P.handR,
      handMat: mats.skin,
      jerseyInk: "#fff",
      trousers: true,
    };
    const plain = buildRigSkin(context, [0, 0, 0], { mergeLods: true });
    const formal = buildRigSkin({ ...context, staffStyle: "jacket" }, [0, 0, 0], {
      mergeLods: true,
    });
    const trimVertices = (skin: typeof formal) =>
      skin.groups
        .filter((group) => group.material === mats.trim)
        .reduce((sum, group) => sum + group.geometry.getAttribute("position").count, 0);
    expect(trimVertices(formal)).toBeGreaterThan(trimVertices(plain));
    expect(countRigSkin(formal)).toBeLessThanOrEqual(HERO_MESH_COST);
    for (const group of formal.groups) {
      expect(group.geometry.getIndex()?.count).toBeGreaterThan(0);
      expect(Array.from(group.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(
        true,
      );
    }
    plain.dispose();
    formal.dispose();
  });
  it("refines neck and palm volume while preserving attachment landmarks and topology", () => {
    for (const part of ["neck", "palm"] as const) {
      const geometry = anatomicalSection(
        part === "neck"
          ? [
              { y: 0, width: P.neckR, depth: P.neckR * 0.92 },
              { y: P.neckLen * 0.65, width: P.neckR * 0.83, depth: P.neckR * 0.8 },
              { y: P.neckLen * 1.25, width: P.neckR * 0.93, depth: P.neckR * 0.86 },
            ]
          : [
              { y: -P.handR * 1.5, width: P.handR * 0.67, depth: P.handR * 0.27 },
              { y: -P.handR * 0.85, width: P.handR * 0.77, depth: P.handR * 0.34 },
              { y: P.handR * 0.08, width: P.handR * 0.54, depth: P.handR * 0.31 },
            ],
        16,
      );
      const original = geometry.getAttribute("position").clone();
      if (part === "neck") neckSurface(geometry, P.neckR, P.neckLen);
      else palmSurface(geometry, P.handR, 1);
      const points = geometry.getAttribute("position");
      expect(points.count).toBe(original.count);
      let volumeChanged = false;
      for (let i = 0; i < points.count; i++) {
        expect(points.getX(i)).toBe(original.getX(i));
        expect(points.getY(i)).toBe(original.getY(i));
        const delta = Math.abs(points.getZ(i) - original.getZ(i));
        expect(delta).toBeLessThan(0.006);
        volumeChanged ||= delta > 0.00001;
      }
      expect(volumeChanged).toBe(true);
      expect(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
  });
  it("bakes natural complexion without seams, new material groups or a different skull", () => {
    const detailed = sculptedHead(P, look.seed);
    const light = sculptedHead(P, look.seed, false);
    for (const geometry of [detailed, light]) {
      const colors = geometry.getAttribute("color");
      const positions = geometry.getAttribute("position");
      expect(colors.count).toBe(positions.count);
      expect(
        Array.from(colors.array).every(
          (value) => Number.isFinite(value) && value >= 0.8 && value <= 1,
        ),
      ).toBe(true);
      // Both LOD grids retain visible pigment variation without requiring
      // the sparse mesh to land exactly on the deepest socket sample.
      expect(
        Math.max(...Array.from(colors.array)) - Math.min(...Array.from(colors.array)),
      ).toBeGreaterThan(0.05);
      const columns = geometry === detailed ? 136 : 18;
      for (let row = 0; row < colors.count; row += columns + 1) {
        for (const component of ["getX", "getY", "getZ"] as const)
          expect(colors[component](row)).toBeCloseTo(colors[component](row + columns), 6);
      }
      expect(geometry.groups).toHaveLength(0);
      geometry.dispose();
    }
  });
  it("preserves adult skull height and a tapered jaw with finite outward normals", () => {
    const geometry = sculptedHead(P, look.seed);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(P.headH, 5);
    expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    expect(Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    const position = geometry.getAttribute("position"),
      normal = geometry.getAttribute("normal");
    let jawWidth = 0,
      cheekWidth = 0;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i) / P.headR;
      if (y < -0.85) jawWidth = Math.max(jawWidth, Math.abs(position.getX(i)));
      if (Math.abs(y) < 0.3) cheekWidth = Math.max(cheekWidth, Math.abs(position.getX(i)));
      if (position.getZ(i) > P.headD * 0.95 && Math.abs(y) < 0.35)
        expect(normal.getZ(i)).toBeGreaterThan(0);
    }
    expect(jawWidth).toBeLessThan(cheekWidth * 0.8);
    geometry.dispose();
  });

  it("embeds almond eyes in the sculpted sockets instead of floating eyeballs", () => {
    const mats = playerMaterials(look, kit, null, "alta");
    const face = buildSculptedFace(P, look, mats, true);
    const lenses = face.face.filter(
      (part) => (part.material as THREE.MeshStandardMaterial).color?.getHexString() === "c9c3b8",
    );
    expect(lenses).toHaveLength(2);
    for (const lens of lenses) {
      const points = lens.geometry.getAttribute("position");
      for (let i = 0; i < points.count; i++) {
        const projection =
          points.getZ(i) - faceSurfaceZ(P, points.getX(i), points.getY(i), look.seed);
        expect(projection).toBeGreaterThan(0);
        expect(projection).toBeLessThan(P.headR * 0.05);
      }
    }
    for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
  });

  it("keeps facial asymmetry subtle, seed-stable, and aligned across eye landmarks", () => {
    const morphology = faceMorphology(look.seed);
    expect(faceMorphology(look.seed)).toBe(morphology);
    expect(Math.abs(morphology.eyeAsymmetry)).toBeLessThanOrEqual(0.012);
    expect(Math.abs(morphology.browAsymmetry)).toBeLessThanOrEqual(0.018);
    expect(Math.abs(morphology.noseDeviation)).toBeLessThanOrEqual(0.012);
    expect(Math.abs(morphology.cheekAsymmetry)).toBeLessThanOrEqual(0.045);
    expect(Math.abs(morphology.mouthTilt)).toBeLessThanOrEqual(0.018);

    const mats = playerMaterials(look, kit, null, "alta");
    const face = buildSculptedFace(P, look, mats, true);
    const eyePatches = face.face.filter(
      (part) => (part.material as THREE.MeshStandardMaterial).color?.getHexString() === "c9c3b8",
    );
    expect(eyePatches).toHaveLength(2);
    const centers = eyePatches.map((part) => {
      const points = part.geometry.getAttribute("position");
      let sum = 0;
      for (let i = 0; i < points.count; i++) sum += points.getY(i);
      return sum / points.count;
    });
    expect(centers[1]! - centers[0]!).toBeCloseTo(morphology.eyeAsymmetry * P.headR * 2, 5);
    for (const parts of Object.values(face)) for (const part of parts) part.geometry.dispose();
  });

  it("keeps the fitted frontal hairline above the eyes in every haircut", () => {
    const styles: HairStyle[] = [
      "buzz",
      "short",
      "medium",
      "curly",
      "afro",
      "mohawk",
      "bun",
      "ponytail",
      "dreads",
      "braids",
    ];
    for (const hairStyle of styles) {
      const hair = sculptedHair(P, { ...look, hairStyle });
      const points = hair.getAttribute("position");
      for (let i = 0; i < points.count; i++) {
        if (points.getZ(i) > P.headD * 0.6 && Math.abs(points.getX(i)) < P.headW * 0.3)
          expect(points.getY(i)).toBeGreaterThan(P.headR * 0.35);
      }
      expect(Array.from(hair.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
      hair.dispose();
    }
  });

  it("joins upper and lower limb ellipses without exposed cap faces", () => {
    for (const [upper, lower, length] of [
      ["upperArm", "forearm", P.upperArm],
      ["thigh", "calf", P.thigh],
    ] as const) {
      const a = anatomicalLimb(upper, length, 0.07, 16),
        b = anatomicalLimb(lower, 0.35, 0.07, 16);
      const pa = a.getAttribute("position"),
        pb = b.getAttribute("position");
      const na = a.getAttribute("normal"),
        nb = b.getAttribute("normal");
      const row = pb.count - 17;
      for (let i = 0; i <= 16; i++) {
        expect(pa.getX(i)).toBeCloseTo(pb.getX(row + i), 6);
        expect(pa.getZ(i)).toBeCloseTo(pb.getZ(row + i), 6);
        expect(na.getY(i)).toBe(0);
        expect(nb.getY(row + i)).toBe(0);
      }
      a.dispose();
      b.dispose();
    }
  });

  it("accounts for material and shadow draws across roles, haircuts and accessories", () => {
    const costs: number[] = [];
    for (const pos of ["MF", "FW", "DF", "GK"])
      for (let seed = 0; seed < 4; seed++)
        for (const sleeves of ["short", "long"] as const)
          for (const hairStyle of ["bald", "short", "afro", "dreads"] as const) {
            const styled = {
              ...lookFor(`budget-${pos}-${seed}`, pos, true),
              sleeves,
              hairStyle,
              beard: "full" as const,
              earring: true,
              wristTape: "left" as const,
              tattoo: "foreR" as const,
              headband: true,
              sockTape: true,
              collar: "polo" as const,
            };
            const proportions = proportionsFor(styled),
              mats = playerMaterials(styled, kit, null, "alta");
            const skin = buildRigSkin(
              {
                P: proportions,
                look: styled,
                segs: { radial: 16, cap: 4 },
                hi: true,
                mats,
                handR: proportions.handR * (styled.gloves ? 1.25 : 1),
                handMat: styled.gloves ? mats.glove : mats.skin,
                jerseyInk: "#fff",
              },
              [0, 0, 0],
            );
            costs.push(
              countRigSkin(skin) +
                skin.groups.filter((group) => group.castShadow && group.lod === "core").length,
            );
            skin.dispose();
          }
    expect(Math.max(...costs)).toBeLessThanOrEqual(HERO_MESH_COST);
  });
});
