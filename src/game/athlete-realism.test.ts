import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lookFor, proportionsFor } from "./player-model";
import { faceMorphology } from "./player-morphology";
import { playerMaterials } from "./player-materials";
import { buildRigBody, type RigBodyContext } from "./rig-body";
import { buildRigSkin, rigRestMatrix } from "./rig-skin";
import { faceSurfaceZ, irisDome, sculptedEar } from "./player-sculpt";
import { anatomicalLimb, tailoredSleeve } from "./rig-geometry";
import { cinematicExpressionAt } from "./cinematic-expression";
import { cinematicShotFor } from "./cinematic-shot";
import { cinematicGestureAt, cinematicPhrases, type CinematicCue } from "./cinematic-cue";

const kit = {
  base: "#ad1733",
  detail: "#171b20",
  shorts: "#15191e",
  socks: "#ad1733",
  pattern: "solid",
} as const;
function athlete(role = "MF"): RigBodyContext {
  const look = { ...lookFor(`realism-${role}`, role), sleeves: "short" as const };
  const P = proportionsFor(look),
    mats = playerMaterials(look, kit, null, "alta");
  return {
    P,
    look,
    mats,
    hi: true,
    segs: { radial: 16, cap: 4 },
    handR: P.handR * (look.gloves ? 1.25 : 1),
    handMat: look.gloves ? mats.glove : mats.skin,
    jerseyInk: "#fff",
  };
}

describe("anatomical surface and cinematic performance regressions", () => {
  it("joins long cloth sleeves to the forearm without a flat shoulder ledge", () => {
    const radius = 0.06,
      length = 0.32,
      radial = 16;
    const sleeve = tailoredSleeve(length, radius, radial),
      forearm = anatomicalLimb("forearm", 0.27, radius, radial);
    const a = sleeve.getAttribute("position"),
      b = forearm.getAttribute("position"),
      row = b.count - radial - 1;
    for (let i = 0; i <= radial; i++) {
      expect(a.getX(i)).toBeCloseTo(b.getX(row + i), 6);
      expect(a.getZ(i)).toBeCloseTo(b.getZ(row + i), 6);
    }
    expect(Array.from(sleeve.getAttribute("normal").array).every(Number.isFinite)).toBe(true);
    sleeve.dispose();
    forearm.dispose();
  });
  it("keeps corneas convex, facing outward and fitted to both eye sockets", () => {
    const { P, look } = athlete();
    for (const side of [-1, 1]) {
      const x = side * P.headW * faceMorphology(look.seed).eyeSpacing;
      const geometry = irisDome(P, x, P.headR * 0.14, look.seed, P.headR * 0.047);
      const position = geometry.getAttribute("position"),
        normal = geometry.getAttribute("normal"),
        uv = geometry.getAttribute("uv");
      let min = Infinity,
        max = -Infinity;
      for (let i = 0; i < position.count; i++) {
        const lift =
          position.getZ(i) - faceSurfaceZ(P, position.getX(i), position.getY(i), look.seed);
        min = Math.min(min, lift);
        max = Math.max(max, lift);
        expect(normal.getZ(i)).toBeGreaterThan(0.55);
        expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getX(i)).toBeLessThanOrEqual(1);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(0);
        expect(uv.getY(i)).toBeLessThanOrEqual(1);
      }
      expect(max - min).toBeCloseTo(P.headR * 0.013, 6);
      expect(min).toBeGreaterThan(P.headR * 0.039);
      expect(max).toBeLessThan(P.headR * 0.054);
      geometry.dispose();
    }
  });

  it("sculpts outward-facing ears with a cheaper distant silhouette", () => {
    const { P } = athlete();
    for (const side of [-1, 1]) {
      const high = sculptedEar(P, side, true),
        low = sculptedEar(P, side, false);
      expect(low.getAttribute("position").count).toBeLessThan(
        high.getAttribute("position").count / 2,
      );
      for (const geometry of [high, low]) {
        const normal = geometry.getAttribute("normal"),
          position = geometry.getAttribute("position");
        for (let i = 0; i < normal.count; i++) {
          expect(normal.getX(i) * side).toBeGreaterThan(0);
          expect(position.getX(i) * side).toBeGreaterThan(P.headW * 0.92);
          expect(Math.abs(position.getY(i))).toBeLessThan(P.headR * 0.31);
        }
        geometry.dispose();
      }
    }
  });

  it.each(["MF", "DF", "FW", "GK"])(
    "hides %s upper-arm skin inside the tailored short sleeve",
    (role) => {
      const ctx = athlete(role),
        body = buildRigBody(ctx);
      for (const part of [...body.armL, ...body.armR]) {
        if (part.material !== ctx.mats.skin) continue;
        part.geometry.computeBoundingBox();
        expect(part.geometry.boundingBox!.max.y).toBeLessThanOrEqual(-ctx.P.upperArm * 0.44 + 1e-6);
      }
      for (const part of body.all) part.geometry.dispose();
    },
  );

  it("opens the actual skinned chin without pulling the nape or adding bones", () => {
    const ctx = athlete(),
      skin = buildRigSkin(ctx, [0, 0, 0]);
    const face = new THREE.Vector3().setFromMatrixPosition(rigRestMatrix(skin, "face"));
    const jawIndex = skin.bones.indexOf(skin.boneOf.jaw);
    const faceIndex = skin.bones.indexOf(skin.boneOf.face);
    const probes: {
      mesh: THREE.SkinnedMesh;
      index: number;
      point: THREE.Vector3;
      chin: boolean;
    }[] = [];
    for (const group of skin.groups) {
      if (group.material !== ctx.mats.skin) continue;
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      mesh.skeleton = skin.skeleton;
      mesh.bindMatrix.copy(skin.bindMatrix);
      mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
      const position = group.geometry.getAttribute("position"),
        indices = group.geometry.getAttribute("skinIndex"),
        weights = group.geometry.getAttribute("skinWeight");
      for (let i = 0; i < position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i);
        const local = p.clone().sub(face);
        const chin =
          indices.getY(i) === jawIndex && weights.getY(i) > 0.9 && local.z > ctx.P.headD * 0.4;
        const nape =
          indices.getX(i) === faceIndex &&
          local.y < -ctx.P.headR * 0.5 &&
          local.z < -ctx.P.headD * 0.4;
        if (chin || nape) probes.push({ mesh, index: i, point: p, chin });
      }
    }
    expect(probes.some((p) => p.chin)).toBe(true);
    expect(probes.some((p) => !p.chin)).toBe(true);
    skin.boneOf.jaw.rotation.x = 0.11;
    skin.root.updateMatrixWorld(true);
    skin.skeleton.update();
    for (const probe of probes) {
      const p = probe.point.clone();
      probe.mesh.applyBoneTransform(probe.index, p);
      if (probe.chin) expect(p.distanceTo(probe.point)).toBeGreaterThan(0.002);
      else expect(p.distanceTo(probe.point)).toBeLessThan(1e-6);
    }
    expect(skin.bones.length).toBeLessThanOrEqual(64);
    expect(skin.groups.length).toBeLessThanOrEqual(24);
    skin.dispose();
  });

  it("keeps expressions bounded and deterministic while punctuation rests close the jaw", () => {
    const cue: CinematicCue = {
      id: "realism",
      speaker: "manager",
      gesture: "explain",
      mood: "neutral",
      tension: 0.4,
      warmth: 0.7,
      decision: false,
      duration: 5,
      phrases: cinematicPhrases("Vamos competir. Com calma, vamos vencer!", 5),
    };
    for (let i = 0; i <= 240; i++) {
      const t = i / 30,
        gesture = cinematicGestureAt(t, cue, 21);
      const expression = cinematicExpressionAt(t, 21, true, 0.45, cue, gesture.weight);
      expect(expression).toEqual(cinematicExpressionAt(t, 21, true, 0.45, cue, gesture.weight));
      expect(Object.values(expression).every(Number.isFinite)).toBe(true);
      expect(expression.blink).toBeGreaterThanOrEqual(0.08);
      expect(expression.blink).toBeLessThanOrEqual(0.98);
      expect(Math.abs(expression.gazeX)).toBeLessThan(0.002);
      if (gesture.phase === "rest") expect(gesture.jaw).toBe(0);
    }
  });

  it("composes a closer portrait without crossing the dialogue axis", () => {
    const close = cinematicShotFor("press", "manager", "close", 1.78);
    const medium = cinematicShotFor("press", "manager", "medio", 1.78);
    const coverage = (shot: typeof close) =>
      new THREE.Vector3(...shot.position).distanceTo(new THREE.Vector3(...shot.target)) *
      2 *
      Math.tan(THREE.MathUtils.degToRad(shot.fov / 2));
    expect(coverage(close)).toBeLessThan(0.85);
    expect(coverage(medium)).toBeGreaterThan(1.7);
    expect(close.position[2]).toBeGreaterThan(close.target[2]);
    const reverse = cinematicShotFor("press", "press", "close", 1.78);
    expect(reverse.position[2]).toBeLessThan(reverse.target[2]);
  });
});
