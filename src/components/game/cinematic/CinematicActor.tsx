import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Speaker } from "@/content/cutscenes";
import { cinematicActorPose, cinematicIdleAt, cinematicLook } from "@/game/cinematic-actor";
import { cinematicDetail } from "@/game/cinematic-performance";
import { emptyPose, mixPose } from "@/game/animation-core";
import { proportionsFor } from "@/game/player-model";
import { playerMaterials, retainPlayerMaterials } from "@/game/player-materials";
import { buildRigSkin } from "@/game/rig-skin";
import { shoulderPose } from "@/game/athlete-posture";
import { applyHandPose } from "@/game/player-hands";
import type { Kit } from "@/game/kits";
import { cinematicTrophyPose } from "@/game/cinematic-trophy-pose";
import { ClubTrophy } from "./CinematicSetDetails";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic-runtime";

export function CinematicActor({
  x,
  z,
  rot = 0,
  color,
  shorts = "#12181c",
  seed = 1,
  pose = "stand",
  scale = 1,
  acting = false,
  role,
  attention,
  holdingTrophy = false,
}: {
  x: number;
  z: number;
  rot?: number;
  color: string;
  shorts?: string;
  seed?: number;
  pose?: "stand" | "sit" | "walk";
  scale?: number;
  acting?: boolean;
  role?: Speaker | undefined;
  /** Another actor's stage mark, used for listening and eye contact. */
  attention?: readonly [number, number] | undefined;
  holdingTrophy?: boolean;
}) {
  const runtime = useCinematicRuntime();
  const staff = Boolean(role && role !== "captain" && role !== "fan");
  const formal = role === "president" || role === "agent";
  const identity =
    role === "manager" ? runtime.look : role ? runtime.cast?.[role]?.look : undefined;
  const look = useMemo(
    () => ({
      ...cinematicLook(seed, identity),
      sleeves: staff ? ("long" as const) : ("short" as const),
      collar: staff ? (formal ? ("v" as const) : ("polo" as const)) : ("crew" as const),
      ...(staff ? { bootColor: "#1b2029", bootAccent: formal ? "#dce5eb" : "#69717c" } : {}),
    }),
    [seed, identity, staff, formal],
  );
  const p = useMemo(() => proportionsFor(look), [look]);
  const kit = useMemo<Kit>(
    () => ({
      base: formal ? "#283744" : color,
      shorts,
      socks: shorts,
      detail: color,
      pattern: "solid",
    }),
    [color, shorts, formal],
  );
  const detail = cinematicDetail(runtime.quality, Boolean(role));
  const materialBase = useMemo(
    () => playerMaterials(look, kit, null, detail.high ? "alta" : "media"),
    [look, kit, detail.high],
  );
  useLayoutEffect(() => retainPlayerMaterials(materialBase), [materialBase]);
  // Solid cinematic costumes share equivalent surfaces while keeping skin,
  // hair and facial details distinct. This does not alter match uniforms.
  const mats = useMemo(
    () => ({
      ...materialBase,
      jerseyPlain: materialBase.jersey,
      trim: formal ? materialBase.bootAccent : materialBase.jersey,
      socks: materialBase.shorts,
    }),
    [materialBase, formal],
  );
  const skin = useMemo(
    () =>
      buildRigSkin(
        {
          P: p,
          look,
          mats,
          hi: detail.high,
          segs: { radial: detail.radial, cap: 4 },
          jerseyInk: color,
          handR: p.handR,
          handMat: mats.skin,
          trousers: staff,
          staffStyle: staff ? (formal ? "jacket" : "polo") : undefined,
        },
        [0, 0, 0],
        { mergeLods: true },
      ),
    [p, look, mats, detail.high, detail.radial, color, staff, formal],
  );
  const group = useRef<THREE.Group>(null);
  const trophy = useRef<THREE.Group>(null);
  const gripL = useMemo(() => new THREE.Vector3(), []);
  const gripR = useMemo(() => new THREE.Vector3(), []);
  const target = useRef(emptyPose());
  const current = useRef(emptyPose());
  const first = useRef(true);
  const listening = useRef(0);
  useLayoutEffect(() => {
    first.current = true;
  }, [skin]);
  useLayoutEffect(() => {
    // Static inspection must refresh its pose; running dialogue blends into
    // the new speaker's gesture instead of snapping all joints at once.
    if (runtime.stopped || runtime.reduced) first.current = true;
  }, [acting, pose, runtime.stopped, runtime.reduced]);
  const meshes = useMemo(
    () =>
      skin.groups.map((part) => {
        const mesh = new THREE.SkinnedMesh(part.geometry, part.material);
        mesh.skeleton = skin.skeleton;
        mesh.bindMatrix.copy(skin.bindMatrix);
        mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        mesh.frustumCulled = false;
        mesh.castShadow =
          runtime.quality !== "baixa" && part.castShadow && part.lod === "core" && Boolean(role);
        return mesh;
      }),
    [skin, runtime.quality, role],
  );
  useEffect(() => () => skin.dispose(), [skin]);
  useCinematicFrame((time, dt) => {
    if (dt === 0 && !first.current) return;
    cinematicActorPose(time, seed, pose, acting, p, target.current, runtime.manner);
    if (holdingTrophy) cinematicTrophyPose(target.current, time);
    const idle = cinematicIdleAt(time, seed, pose === "sit");
    const cross = !holdingTrophy && !acting && idle.kind === "cross" ? idle.weight : 0;
    mixPose(
      current.current,
      target.current,
      first.current || runtime.reduced ? 1 : 1 - Math.exp(-12 * dt),
      current.current,
    );
    const c = current.current,
      b = skin.boneOf;
    const wantedYaw =
      attention && !acting
        ? THREE.MathUtils.clamp(Math.atan2(attention[0] - x, attention[1] - z) - rot, -0.7, 0.7)
        : 0;
    listening.current =
      first.current || runtime.reduced
        ? wantedYaw
        : THREE.MathUtils.damp(listening.current, wantedYaw, 5, dt);
    const listeningYaw = listening.current;
    if (pose === "sit") {
      // Leg IK already follows a smooth contact path. Interpolating the
      // joint angles again would disconnect it from the root's rise timing.
      for (const key of [
        "hipY",
        "legLPitch",
        "legRPitch",
        "kneeL",
        "kneeR",
        "ankleL",
        "ankleR",
      ] as const)
        c[key] = target.current[key];
    }
    b.hips.position.y = p.hipY + c.hipY;
    b.hips.rotation.set(c.hipPitch, c.hipYaw, c.hipRoll);
    b.spine.rotation.set(c.spine, -c.hipYaw * 0.45, -c.hipRoll * 0.35);
    b.chest.rotation.x = c.chest + p.posture;
    b.neck.rotation.set(c.headPitch * 0.45, (c.headYaw + listeningYaw) * 0.55, 0);
    b.face.rotation.set(
      c.headPitch * 0.55,
      (c.headYaw + listeningYaw) * 0.45,
      !acting && idle.kind === "tilt" ? idle.weight * 0.085 : 0,
    );
    for (const left of [true, false]) {
      const s = left ? "L" : "R";
      const shoulder = shoulderPose(
        left ? c.armLPitch : c.armRPitch,
        left ? c.armLRoll : c.armRRoll,
      );
      b[`clav${s}`].rotation.set(shoulder.clavPitch, 0, shoulder.clavRoll);
      b[`arm${s}`].rotation.set(
        shoulder.armPitch,
        shoulder.armYaw + (left ? 1 : -1) * cross * 1.1,
        shoulder.armRoll,
      );
      b[`fore${s}`].rotation.x = left ? c.elbowL : c.elbowR;
      b[`leg${s}`].rotation.set(
        left ? c.legLPitch : c.legRPitch,
        0,
        left ? c.legLRoll : c.legRRoll,
      );
      b[`knee${s}`].rotation.x = -(left ? c.kneeL : c.kneeR);
      b[`ankle${s}`].rotation.x = left ? c.ankleL : c.ankleR;
    }
    if (detail.high) {
      applyHandPose(
        b,
        {
          grip: holdingTrophy ? 0.65 : cross > 0.3 ? 0.4 : acting ? 0.14 : 0.22,
          spread: acting ? 0.07 : 0.02,
          wrist: cross * 0.06,
        },
        first.current ? 0.25 : dt,
      );
      b.jaw.rotation.x = acting ? 0.02 + Math.abs(Math.sin(time * 7.4 + seed)) * 0.07 : 0;
      const blink = time % (4.1 + (seed % 3) * 0.2);
      b.blink.scale.y = blink < 0.16 ? 0.08 + Math.sin((blink / 0.16) * Math.PI) * 0.9 : 0.08;
      for (const left of [true, false]) {
        const brow = b[left ? "browL" : "browR"];
        brow.position.y = p.headR * 0.31 + (acting ? Math.sin(time * 2.2 + seed) * 0.004 : 0);
        brow.rotation.z = (left ? 1 : -1) * (acting ? 0.035 : 0);
      }
    }
    first.current = false;
    if (group.current) {
      const rise = !acting && pose === "sit" && idle.kind === "rise" ? p.thigh * idle.weight : 0;
      group.current.position.set(
        x + Math.sin(rot) * rise,
        pose === "walk" ? Math.max(0, c.hipY * 0.4) : 0,
        z + Math.cos(rot) * rise,
      );
      if (holdingTrophy && trophy.current) {
        // Anchor to the animated grip midpoint in actor space, including
        // breathing, the lift and the return. Props remain outside batching.
        group.current.updateWorldMatrix(true, true);
        gripL.set(0, -p.handR * 0.65, p.handR * 0.1).applyMatrix4(b.handL.matrixWorld);
        gripR.set(0, -p.handR * 0.65, p.handR * 0.1).applyMatrix4(b.handR.matrixWorld);
        gripL.add(gripR).multiplyScalar(0.5);
        group.current.worldToLocal(gripL);
        trophy.current.position.copy(gripL);
        trophy.current.position.y -= 0.35 * 0.9;
      }
    }
  });
  return (
    <group ref={group} position={[x, 0, z]} rotation-y={rot} scale={scale} dispose={null}>
      <primitive object={skin.root} />
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
      {holdingTrophy && (
        <group ref={trophy}>
          <ClubTrophy x={0} y={0} z={0} scale={0.9} dynamic />
        </group>
      )}
    </group>
  );
}
