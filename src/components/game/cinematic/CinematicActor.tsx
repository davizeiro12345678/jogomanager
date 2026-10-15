import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "@react-three/fiber";
import * as THREE from "three";
import type { Speaker } from "@/content/cutscenes";
import { cinematicActorPose, cinematicIdleAt, cinematicLook } from "@/game/cinematic-actor";
import { cinematicDetail, cinematicHairMotionDriveAt } from "@/game/cinematic-performance";
import {
  advanceAthleteHairMotion,
  createAthleteHairMotionState,
} from "@/game/athlete-secondary-motion";
import { compactCinematicSkin } from "@/game/cinematic-skin";
import { cinematicGestureAt } from "@/game/cinematic-cue";
import { cinematicExpressionAt, CinematicGaze } from "@/game/cinematic-expression";
import { eyelidRotationFor } from "@/game/facial-animation";
import {
  cinematicAttentionYaw,
  cinematicCurlAt,
  cinematicDrillAt,
  cinematicDrillFor,
  cinematicDrillPose,
} from "@/game/cinematic-action";
import { emptyPose, mixPose } from "@/game/animation-core";
import { proportionsFor } from "@/game/player-model";
import { faceMorphology } from "@/game/player-morphology";
import {
  detailTextureNames,
  playerMaterials,
  retainPlayerMaterials,
} from "@/game/player-materials";
import { requestKtx2 } from "@/game/textures/ktx2";
import { buildRigSkin } from "@/game/rig-skin";
import { updateRigCorrectives } from "@/game/rig-correctives";
import { AthleteCloth } from "@/game/athlete-cloth";
import { shoulderPose } from "@/game/athlete-posture";
import { applyHandPose } from "@/game/player-hands";
import type { Kit } from "@/game/kits";
import { cinematicTrophyPose } from "@/game/cinematic-trophy-pose";
import { ClubTrophy } from "./CinematicSetDetails";
import { CinematicDumbbell } from "./CinematicDumbbell";
import { CinematicClipboard } from "./CinematicClipboard";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic-runtime";
import type { MouthPose } from "@/game/cutscene-visemes";

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
  entrance = false,
  drillIndex,
  exercise = false,
  recovery = false,
  clipboard = false,
  costume,
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
  entrance?: boolean;
  drillIndex?: number;
  exercise?: boolean;
  recovery?: boolean;
  clipboard?: boolean;
  costume?: "staff" | "player";
}) {
  const runtime = useCinematicRuntime();
  const staff = costume === "staff" || Boolean(role && role !== "captain" && role !== "fan");
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
  const facialShape = useMemo(() => faceMorphology(look.seed), [look.seed]);
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
  // A speaker or a player carrying the scene receives portrait anatomy in
  // the automatic medium tier. Crowds stay compact, so a team procession
  // does not spend the visual budget intended for the camera subject.
  const narrativeSubject = Boolean(role || acting || holdingTrophy || entrance || clipboard);
  const detail = cinematicDetail(runtime.quality, narrativeSubject);
  const looseHairStyle =
    look.hairStyle === "ponytail" || look.hairStyle === "dreads" || look.hairStyle === "braids"
      ? look.hairStyle
      : "none";
  // Close-up dialogue exposes pores, fabric, hair direction and boot grain.
  // A cutscene normally has one or two narrative subjects, so their physical
  // material pass can start at the balanced tier while extras remain on the
  // inexpensive standard surfaces.
  const materialQuality = detail.portrait ? "alta" : "media";
  useEffect(() => {
    if (detail.portrait) requestKtx2(detailTextureNames(look, kit));
  }, [detail.portrait, look, kit]);
  const materialBase = useMemo(
    () => playerMaterials(look, kit, null, materialQuality),
    [look, kit, materialQuality],
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
  const skin = useMemo(() => {
    const built = buildRigSkin(
      {
        P: p,
        look,
        mats,
        hi: detail.portrait,
        portrait: detail.portrait,
        segs: { radial: detail.radial, cap: 4 },
        jerseyInk: color,
        handR: p.handR,
        handMat: mats.skin,
        trousers: staff,
        staffStyle: staff ? (formal ? "jacket" : "polo") : undefined,
      },
      [0, 0, 0],
      { mergeLods: true },
    );
    return detail.portrait ? built : compactCinematicSkin(built);
  }, [p, look, mats, detail.portrait, detail.radial, color, staff, formal]);
  const cloth = useMemo(
    () => new AthleteCloth(skin, p, detail.portrait),
    [skin, p, detail.portrait],
  );
  const group = useRef<THREE.Group>(null);
  const trophy = useRef<THREE.Group>(null);
  const gripL = useMemo(() => new THREE.Vector3(), []);
  const gripR = useMemo(() => new THREE.Vector3(), []);
  const target = useRef(emptyPose());
  const drillScratch = useRef(emptyPose());
  const mouthPose = useRef<MouthPose>({ open: 0.015, wide: 0.1, round: 0 });
  const current = useRef(emptyPose());
  const first = useRef(true);
  const listening = useRef(new CinematicGaze());
  const hairMotion = useRef(createAthleteHairMotionState());
  useLayoutEffect(() => {
    first.current = true;
  }, [skin]);
  useLayoutEffect(() => {
    // Static inspection must refresh its pose; running dialogue blends into
    // the new speaker's gesture instead of snapping all joints at once.
    if (runtime.stopped || runtime.reduced) first.current = true;
  }, [acting, pose, runtime.stopped, runtime.reduced, runtime.cue?.id]);
  const meshes = useMemo(
    () =>
      skin.groups.map((part) => {
        const mesh = new THREE.SkinnedMesh(part.geometry, part.material);
        cloth.bind(mesh);
        mesh.skeleton = skin.skeleton;
        mesh.bindMatrix.copy(skin.bindMatrix);
        mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        mesh.frustumCulled = false;
        mesh.castShadow =
          runtime.quality !== "baixa" && part.castShadow && part.lod === "core" && narrativeSubject;
        return mesh;
      }),
    [skin, runtime.quality, narrativeSubject, cloth],
  );
  useEffect(() => () => skin.dispose(), [skin]);
  useCinematicFrame((time, dt) => {
    if (dt === 0 && !first.current) return;
    const arriving = entrance && time < 4.8;
    const posture = arriving ? "walk" : pose;
    cinematicActorPose(
      time,
      seed,
      posture,
      acting && !arriving,
      p,
      target.current,
      runtime.manner,
      runtime.cue,
      runtime.clock.lineTime,
      exercise || recovery,
    );
    const drill =
      drillIndex === undefined
        ? null
        : cinematicDrillAt(time, drillIndex, cinematicDrillFor(runtime.cue?.id.split(":")[0]));
    if (drill) cinematicDrillPose(target.current, drill, p, time, acting, drillScratch.current);
    if (exercise && !acting) {
      const curl = cinematicCurlAt(time);
      target.current.armLPitch = -0.1 - curl.left * 0.22;
      target.current.armRPitch = -0.1 - curl.right * 0.22;
      target.current.elbowL = -0.25 - curl.left * 1.65;
      target.current.elbowR = -0.25 - curl.right * 1.65;
    }
    if (clipboard) {
      target.current.armLPitch = -0.24;
      target.current.armLRoll = 0.09;
      target.current.elbowL = -1.22;
    }
    if (holdingTrophy) cinematicTrophyPose(target.current, time);
    const idle = cinematicIdleAt(time, seed, pose === "sit");
    const cross =
      !holdingTrophy && !exercise && !recovery && !clipboard && !acting && idle.kind === "cross"
        ? idle.weight
        : 0;
    mixPose(
      current.current,
      target.current,
      first.current || runtime.reduced ? 1 : 1 - Math.exp(-12 * dt),
      current.current,
    );
    const c = current.current,
      b = skin.boneOf;
    const wantedYaw = attention
      ? cinematicAttentionYaw(drill?.x ?? x, drill?.z ?? z, drill?.yaw ?? rot, attention)
      : 0;
    const gaze = listening.current.sample(wantedYaw, dt, first.current || runtime.reduced);
    const listeningYaw = gaze.headYaw;
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
    const delivery = runtime.cue
      ? cinematicGestureAt(runtime.clock.lineTime, runtime.cue, seed)
      : null;
    const expression = cinematicExpressionAt(
      time,
      seed,
      acting,
      gaze.eyeYaw,
      runtime.cue,
      delivery?.weight ?? 0,
    );
    b.hips.position.y = p.hipY + c.hipY;
    b.hips.rotation.set(c.hipPitch, c.hipYaw, c.hipRoll);
    b.spine.rotation.set(c.spine, -c.hipYaw * 0.45, -c.hipRoll * 0.35);
    b.chest.rotation.set(c.chest + p.posture, -c.hipYaw * 0.55, -c.hipRoll * 0.2);
    b.neck.rotation.set(
      (c.headPitch + expression.headPitch) * 0.45,
      (c.headYaw + listeningYaw) * 0.55,
      0,
    );
    b.face.rotation.set(
      (c.headPitch + expression.headPitch) * 0.55,
      (c.headYaw + listeningYaw) * 0.45,
      (!acting && idle.kind === "tilt" ? idle.weight * 0.085 : 0) + expression.headRoll,
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
      const dominant = delivery ? delivery.side === (left ? -1 : 1) : !left;
      const openness =
        acting && !exercise && !holdingTrophy && !(clipboard && left)
          ? (delivery?.weight ?? 0) * (dominant ? 1 : 0.55)
          : 0;
      // Palms rotate toward the listener during a question/explanation, then
      // settle. The existing forearm twist distributes that rotation.
      b[`hand${s}`].rotation.set(
        -openness * 0.12,
        (left ? 1 : -1) * openness * 0.48,
        (left ? 1 : -1) * openness * 0.075,
      );
      b[`leg${s}`].rotation.set(
        left ? c.legLPitch : c.legRPitch,
        0,
        left ? c.legLRoll : c.legRRoll,
      );
      b[`knee${s}`].rotation.x = -(left ? c.kneeL : c.kneeR);
      b[`ankle${s}`].rotation.x = left ? c.ankleL : c.ankleR;
    }
    // Authored mouth shapes follow the same audio clock in every render tier.
    // Reuse the output object so viseme sampling does not allocate per actor/frame.
    const syncedMouth = acting
      ? (runtime.voiceClockRef?.current?.sample(mouthPose.current) ?? null)
      : null;
    b.jaw.rotation.x = acting
      ? syncedMouth
        ? 0.02 + syncedMouth.open * 0.22
        : (delivery?.jaw ?? 0.02 + Math.abs(Math.sin(time * 7.4 + seed)) * 0.07)
      : 0;
    b.jaw.scale.set(
      syncedMouth ? 1 + syncedMouth.wide * 0.08 - syncedMouth.round * 0.05 : 1,
      1,
      syncedMouth ? 1 + syncedMouth.round * 0.06 : 1,
    );
    const upperLidRotation = eyelidRotationFor(expression.blink, true);
    const lowerLidRotation = eyelidRotationFor(expression.blink, false);
    b.eyelidUpperL.rotation.x = upperLidRotation;
    b.eyelidUpperR.rotation.x = upperLidRotation;
    b.eyelidLowerL.rotation.x = lowerLidRotation;
    b.eyelidLowerR.rotation.x = lowerLidRotation;
    b.eyes.position.set(expression.gazeX, expression.gazeY, 0);
    for (const left of [true, false]) {
      const brow = b[left ? "browL" : "browR"];
      brow.position.y =
        p.headR * (0.31 + facialShape.browAsymmetry * (left ? 1 : -1)) + expression.browLift;
      brow.rotation.z = (left ? 1 : -1) * expression.browTilt;
      const wrist = b[left ? "handL" : "handR"];
      if (exercise) wrist.rotation.set(0, 0, (left ? 1 : -1) * 0.06);
      else if (clipboard && left) wrist.rotation.set(0, 0.08, 0);
    }
    if (detail.portrait) {
      const leftLeads = delivery ? delivery.side === -1 : false;
      const handPose = (left: boolean) => {
        const lead = left === leftLeads;
        const gesture = acting ? (delivery?.weight ?? 0) : 0;
        return {
          grip:
            exercise || clipboard
              ? 0.6
              : holdingTrophy
                ? 0.65
                : cross > 0.3
                  ? 0.4
                  : 0.16 + gesture * (lead ? 0.28 : 0.12),
          spread: acting ? 0.025 + gesture * (lead ? 0.11 : 0.055) : 0.02,
          wrist: cross * 0.06 + (left ? -1 : 1) * gesture * (lead ? 0.05 : 0.018),
        };
      };
      applyHandPose(b, handPose(true), first.current ? 0.25 : dt, "L");
      applyHandPose(b, handPose(false), first.current ? 0.25 : dt, "R");
    }
    // Wrist pose must be final before distributing pronation into the ulna.
    updateRigCorrectives(b);
    if (detail.portrait && looseHairStyle !== "none") {
      advanceAthleteHairMotion(
        hairMotion.current,
        cinematicHairMotionDriveAt({
          time,
          seed,
          dt,
          moving: arriving || pose === "walk",
          hipPitch: c.hipPitch + c.spine,
          hipYaw: c.hipYaw + c.chest,
          headYaw: c.headYaw + listeningYaw,
          style: looseHairStyle,
        }),
      );
      b.hairMotion.rotation.set(
        hairMotion.current.pitch,
        hairMotion.current.yaw,
        hairMotion.current.roll,
      );
    } else {
      hairMotion.current.pitch = 0;
      hairMotion.current.yaw = 0;
      hairMotion.current.roll = 0;
      hairMotion.current.pitchVelocity = 0;
      hairMotion.current.yawVelocity = 0;
      hairMotion.current.rollVelocity = 0;
      b.hairMotion.rotation.set(0, 0, 0);
    }
    cloth.update(dt, {
      x: c.hipRoll * 2,
      z: arriving ? 3 / 4.8 : pose === "walk" ? 1.3 : 0,
      lift: Math.max(0, c.hipY),
      effort: exercise || drill ? 0.7 : acting ? 0.2 : 0,
      bend: Math.abs(c.spine) + Math.abs(c.legLPitch - c.legRPitch) * 0.18,
      yaw: rot,
      roll: c.hipRoll,
      legL: Math.min(1, Math.abs(c.kneeL) * 0.58 + Math.abs(c.legLPitch) * 0.24),
      legR: Math.min(1, Math.abs(c.kneeR) * 0.58 + Math.abs(c.legRPitch) * 0.24),
    });
    first.current = false;
    if (group.current) {
      const rise =
        !exercise && !recovery && !acting && pose === "sit" && idle.kind === "rise"
          ? p.thigh * idle.weight
          : 0;
      group.current.position.set(
        x + Math.sin(rot) * rise,
        pose === "walk" && !drill ? Math.max(0, c.hipY * 0.4) : 0,
        z + Math.cos(rot) * rise,
      );
      if (entrance) {
        const u = Math.min(1, time / 4.8);
        group.current.position.z = z - (1 - u) * 3;
      }
      if (drill) {
        group.current.position.x = drill.x;
        group.current.position.z = drill.z;
        group.current.rotation.y = drill.yaw;
      }
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
      {exercise && createPortal(<CinematicDumbbell dynamic />, skin.boneOf.handL)}
      {exercise && createPortal(<CinematicDumbbell dynamic />, skin.boneOf.handR)}
      {clipboard && createPortal(<CinematicClipboard />, skin.boneOf.handL)}
    </group>
  );
}
