import { useFrame } from "@react-three/fiber";
import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  emptyPose,
  getClip,
  mixPose,
  type ClipName,
  type Pose,
  type SelectCtx,
} from "@/game/animation";
import { selectPlayerClip } from "@/game/visual-clip-selection";
import { clothContactPulse } from "@/game/cloth-contact";
import { ballGazePitch, emptyFacialPose } from "@/game/facial-animation";
import {
  emptyActionContext,
  emptyContactContext,
  getDominantFoot,
  type ActionContext,
  type ContactContext,
  type DominantFoot,
} from "@/game/visual-context";
import { solveFullIK } from "@/game/ik-solver";
import type { RigJoint, RigSkin } from "@/game/rig-skin";
import { spineRollForAction, updateRigCorrectives } from "@/game/rig-correctives";
import type { FaceMorphology } from "@/game/player-morphology";
import { AthleteCloth, type ClothMotion } from "@/game/athlete-cloth";
import { airborneFactor, clampPoseAnatomy, solveGroundContact } from "@/game/ground-contact";
import { gaitPoseAt, locomotionWeight } from "@/game/gait-kinematics";
import { visualMotionFor } from "@/game/visual-motion";
import { goalPresentationFor, type GoalFocusRef } from "@/game/goal-choreography";
import {
  footballSupportFor,
  refineFootballAction,
  refineBallFootContact,
} from "@/game/football-action";
import { refineAthletePosture, shoulderPose } from "@/game/athlete-posture";
import { applyHandPose, handPoseAt } from "@/game/player-hands";
import { AthletePoseBlender } from "@/game/athlete-pose-blender";
import {
  advanceAthleteHairMotion,
  createAthleteHairMotionState,
} from "@/game/athlete-secondary-motion";
import { visualDataFor } from "@/game/visual-frame-cache";
import {
  lodForDistance,
  type LodLevel,
  type PlayerLook,
  type Proportions,
} from "@/game/player-model";
import { type SimPlayer, type SimView } from "@/game/sim";
import { type Quality } from "./player-rig-contract";
import { applyRigFacialPresentation } from "./player-rig-face";
import {
  PlayerRigAnimationClock,
  resolvePlayerRigAnimationFrame,
  supportShiftAt,
} from "./player-rig-animation";

export type PlayerRigBoneRefs = Pick<
  Record<RigJoint, React.RefObject<THREE.Bone | null>>,
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "jaw"
  | "eyes"
  | "eyelidUpperL"
  | "eyelidLowerL"
  | "eyelidUpperR"
  | "eyelidLowerR"
  | "clavL"
  | "clavR"
  | "armL"
  | "armR"
  | "foreL"
  | "foreR"
  | "handL"
  | "handR"
  | "legL"
  | "legR"
  | "kneeL"
  | "kneeR"
  | "ankleL"
  | "ankleR"
>;

interface PlayerRigFrameInput {
  scene: {
    player: SimPlayer;
    sim: SimView;
    goalPulse: React.MutableRefObject<number>;
    goalFocus: GoalFocusRef | undefined;
    look: PlayerLook;
    proportions: Proportions;
    facialShape: Readonly<FaceMorphology>;
    quality: Quality;
    portrait: boolean;
    denseGeometry: boolean;
    hi: boolean;
    shadows: boolean;
    paused: boolean;
    previewClip: ClipName | undefined;
    previewAt: number | undefined;
    wet: number;
    onPoseReady: ((skin: RigSkin) => void) | undefined;
  };
  resources: {
    root: React.RefObject<THREE.Group | null>;
    shadowRef: React.RefObject<THREE.Mesh | null>;
    bones: PlayerRigBoneRefs;
    painted: React.RefObject<boolean>;
    lodState: React.RefObject<LodLevel | null>;
    castState: React.RefObject<boolean | null>;
    nearMeshes: React.RefObject<THREE.SkinnedMesh[]>;
    bootMeshes: React.RefObject<THREE.SkinnedMesh[]>;
    skin: RigSkin;
    cloth: AthleteCloth;
  };
}

export function usePlayerRigFrame({ scene, resources }: PlayerRigFrameInput) {
  const {
    player,
    sim,
    goalPulse,
    goalFocus,
    look,
    proportions: P,
    facialShape,
    quality,
    portrait,
    denseGeometry,
    hi,
    shadows,
    paused,
    previewClip,
    previewAt,
    wet,
    onPoseReady,
  } = scene;
  const {
    root,
    shadowRef,
    bones,
    painted,
    lodState,
    castState,
    nearMeshes,
    bootMeshes,
    skin,
    cloth,
  } = resources;
  const {
    hips,
    spine,
    chest,
    neck,
    jaw: jawRef,
    eyes: eyesRef,
    eyelidUpperL: eyelidUpperLRef,
    eyelidLowerL: eyelidLowerLRef,
    eyelidUpperR: eyelidUpperRRef,
    eyelidLowerR: eyelidLowerRRef,
    clavL: clavLRef,
    clavR: clavRRef,
    armL: armLRef,
    armR: armRRef,
    foreL: foreLRef,
    foreR: foreRRef,
    handL: handLRef,
    handR: handRRef,
    legL: legLRef,
    legR: legRRef,
    kneeL: kneeLRef,
    kneeR: kneeRRef,
    ankleL: ankleLRef,
    ankleR: ankleRRef,
  } = bones;
  const playerIndex = useMemo(
    () => sim.players.findIndex((candidate) => candidate.id === player.id),
    [sim.players, player.id],
  );
  const fallbackContext = useMemo(
    () => ({ action: emptyActionContext(), contact: emptyContactContext() }),
    [],
  );
  const dominantFoot: DominantFoot = getDominantFoot(player.pid);
  const isGK = player.pos === "GK";
  const looseHairStyle =
    look.hairStyle === "ponytail" || look.hairStyle === "dreads" || look.hairStyle === "braids"
      ? look.hairStyle
      : "none";
  const seed = look.seed % 97;
  const cur = useRef<Pose>(emptyPose());
  const poseBlender = useMemo(() => new AthletePoseBlender(), []);
  const blendBuf = useRef<Pose>(emptyPose());
  const ikBuf = useRef<Pose>(emptyPose());
  const clipName = useRef<ClipName>("idle");
  const clipTime = useRef(0);
  const animationClock = useMemo(() => new PlayerRigAnimationClock(), []);
  const lastClothTime = useRef<number | null>(null);
  const looseHair = useRef(createAthleteHairMotionState());
  const idleFor = useRef(0);
  const gaitBuffer = useRef(emptyPose());
  const handBuffers = useMemo(
    () => ({
      L: { grip: 0, spread: 0, wrist: 0, pronation: 0, deviation: 0 },
      R: { grip: 0, spread: 0, wrist: 0, pronation: 0, deviation: 0 },
    }),
    [],
  );
  const clothInput = useMemo<ClothMotion>(
    () => ({
      x: 0,
      z: 0,
      lift: 0,
      effort: 0,
      bend: 0,
      yaw: 0,
      roll: 0,
      legL: 0,
      legR: 0,
    }),
    [],
  );
  const sampled = useRef<number | undefined>(undefined);
  const detailState = useRef<boolean | null>(null);
  const facialBuffer = useRef(emptyFacialPose());
  const rootY = useRef(0);
  const contactL = useRef(1);
  const contactR = useRef(1);
  const accelerationLean = useRef(0);
  useFrame((state, rawDt) => {
    if (paused && painted.current && sampled.current === previewAt) {
      // A paused pose still serves a changed inspection camera. Do not
      // re-run animation or smoothing just to switch from body to gloves.
      // Keep the cloth clock current so resuming a paused studio pose cannot
      // integrate every wall-clock millisecond as one visible fabric jump.
      lastClothTime.current = state.clock.elapsedTime;
      onPoseReady?.(skin);
      return;
    }
    const g = root.current;
    if (!g) {
      lastClothTime.current = state.clock.elapsedTime;
      return;
    }
    // Secondary springs use a bounded integration step; pose clocks retain
    // the full elapsed interval below, including frames longer than 50 ms.
    const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(rawDt, 0.05)) : 0;

    // A vista do Worker já interpola snapshots. Uma segunda mola aqui fazia o
    // corpo perseguir um alvo em movimento e criava jitter em FPS variável.
    g.position.x = player.x;
    g.position.z = player.z;

    // Fora do enquadramento atualiza apenas posição. A direção vem diretamente
    // da matriz da câmera, evitando 22 normalizações de vetor por quadro.
    const cameraMatrix = state.camera.matrixWorld.elements;
    const toX = g.position.x - state.camera.position.x;
    const toZ = g.position.z - state.camera.position.z;
    const facing = toX * -cameraMatrix[8]! + toZ * -cameraMatrix[10]!;
    const dist2 = toX * toX + toZ * toZ;
    if (facing < -4 && dist2 > 144) {
      animationClock.reset();
      // A culled player resumes from the current rendering clock, not from
      // an elapsed interval that may span a long off-screen sequence.
      lastClothTime.current = state.clock.elapsedTime;
      return;
    }

    // ---- LOD por distância
    const camDist = Math.sqrt(dist2);
    const lod = lodForDistance(camDist, quality, lodState.current);
    const visibleDetail = portrait || denseGeometry;
    if (lod !== lodState.current || detailState.current !== visibleDetail) {
      const first = lodState.current === null;
      lodState.current = lod;
      detailState.current = visibleDetail;
      for (const mesh of nearMeshes.current) mesh.visible = lod === 0 && visibleDetail;
      for (const mesh of bootMeshes.current) mesh.visible = lod <= 1 && visibleDetail;

      // Sombra projetada custa uma segunda passagem de desenho por malha.
      // Só o atleta perto da câmera entra no mapa de sombras; os demais ficam
      // com a sombra de contato no gramado, que é uma malha só.
      const cast = shadows && lod === 0;
      if (cast !== castState.current || first) {
        castState.current = cast;
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          // os grupos de detalhe nunca entram no mapa de sombras
          if (m.isMesh && m !== shadowRef.current && m.castShadow !== undefined) {
            if (m.name.startsWith("rig-") && m.name !== "rig-core") return;
            m.castShadow = cast;
          }
        });
      }
    }

    // ---- orientação: olha para onde corre; sem bola, olha para a bola
    const ballDistance = Math.hypot(sim.ball.x - player.x, sim.ball.z - player.z);
    const motion = visualMotionFor(
      sim,
      player,
      sim.ball,
      look.seed,
      P.thigh + P.shin,
      state.clock.elapsedTime,
      sim.possession !== player.side && ballDistance < 12,
    );
    const dirLen = motion.speed;
    const goalPresentation = goalPresentationFor(
      player,
      goalFocus?.current ?? null,
      goalPulse.current,
    );
    const action = goalPresentation?.action ?? player.action;
    let facingYaw = motion.yaw;
    if (goalPresentation?.facingYaw !== undefined) {
      const delta = Math.atan2(
        Math.sin(goalPresentation.facingYaw - motion.yaw),
        Math.cos(goalPresentation.facingYaw - motion.yaw),
      );
      facingYaw += delta * goalPresentation.facingWeight;
    }
    g.position.x = goalPresentation?.rootX ?? player.x;
    g.position.z = goalPresentation?.rootZ ?? player.z;
    g.rotation.set(motion.leanX, facingYaw, motion.leanZ, "YXZ");
    accelerationLean.current = motion.accelerationLean;
    const animateDetail = lod === 0 && visibleDetail;
    if (hi && animateDetail && looseHairStyle !== "none") {
      advanceAthleteHairMotion(looseHair.current, {
        dt,
        speed: motion.speed,
        accelerationLean: motion.accelerationLean,
        turnRate: motion.turnRate,
        phase: motion.phase,
        style: looseHairStyle,
      });
      skin.boneOf.hairMotion.rotation.set(
        looseHair.current.pitch,
        looseHair.current.yaw,
        looseHair.current.roll,
      );
    } else {
      looseHair.current.pitch = 0;
      looseHair.current.yaw = 0;
      looseHair.current.roll = 0;
      looseHair.current.pitchVelocity = 0;
      looseHair.current.yawVelocity = 0;
      looseHair.current.rollVelocity = 0;
      skin.boneOf.hairMotion.rotation.set(0, 0, 0);
    }

    // ---- passo de animação em taxa reduzida longe da câmera
    const step = paused || previewAt !== undefined || lod === 0 ? 0 : lod === 1 ? 1 / 36 : 1 / 16;
    const adt = animationClock.consume(rawDt, step);
    if (adt === null) return;

    const speed = dirLen;
    // histerese: só é "parado" depois de ~0,25 s praticamente sem deslocamento,
    // e volta a "em movimento" assim que anda de verdade (evita piscar clipes).
    if (speed < 0.45) idleFor.current += adt;
    else if (speed > 0.9) idleFor.current = 0;
    const stopped = idleFor.current > 0.25;

    const selection: SelectCtx = {
      isGK,
      action,
      actionT: goalPresentation ? 1 - goalPresentation.progress : player.actionT,
      actionDur: goalPresentation ? 1 : player.actionDur,
      ...(goalPresentation ? { actionSeed: goalPresentation.actionSeed } : {}),
      speed,
      hasBall: sim.ball.holder === player.id,
      ballDist: ballDistance,
      ballHeight: sim.ball.height,
      stamina: player.stamina,
      defending: sim.possession !== player.side,
      stopped,
      seed,
      time: sim.time,
    };
    const animationFrame = resolvePlayerRigAnimationFrame({
      currentClip: clipName.current,
      currentTime: clipTime.current,
      deltaSeconds: adt,
      previewClip,
      selectedClip: previewClip ? undefined : selectPlayerClip(sim, player.id, selection),
      previewAt,
      goalProgress: goalPresentation?.progress,
      selection,
    });
    clipName.current = animationFrame.clip;
    clipTime.current = animationFrame.clipTime;
    const u = animationFrame.progress;
    const ctx = animationFrame.context;
    let p = getClip(clipName.current)(ctx);

    const gaitWeight = locomotionWeight(speed, action, clipName.current);
    if (gaitWeight > 0) {
      const gait = gaitPoseAt(motion.phase, speed, P, gaitBuffer.current, {
        forward: motion.forward,
        lateral: motion.lateral,
        turnRate: motion.turnRate,
        stamina: player.stamina,
        hasBall: sim.ball.holder === player.id,
        style: look.seed,
      }).pose;
      p = mixPose(p, gait, gaitWeight, blendBuf.current);
    }

    // ---- IK contextual compartilhado: o contexto é gerado uma vez por
    // snapshot e reutilizado por todos os atletas, sem ficar obsoleto.
    const visualCtx = visualDataFor(sim);
    const actionContext: ActionContext =
      visualCtx?.actionContexts[playerIndex] ?? fallbackContext.action;
    const contactContext: ContactContext =
      visualCtx?.contactContexts[playerIndex] ?? fallbackContext.contact;
    if (visualCtx && lod === 0 && action && !goalPresentation) {
      const playerInfo = {
        x: player.x,
        z: player.z,
        vx: player.vx,
        vz: player.vz,
        rotationY: g.rotation.y,
        actionT: player.actionT,
        actionDur: player.actionDur,
        isGK: player.pos === "GK",
      };

      // Aplica IK completo
      p = solveFullIK(p, actionContext, contactContext, playerInfo, ikBuf.current);
    }
    refineFootballAction(
      p,
      action,
      u,
      P,
      actionContext.action ? actionContext.usedFoot : dominantFoot,
    );
    if (action && lod === 0) {
      const ball = sim.visualBall ?? sim.ball;
      const dx = ball.x - g.position.x,
        dz = ball.z - g.position.z;
      const yaw = motion.yaw;
      refineBallFootContact(
        p,
        action,
        u,
        P,
        actionContext.action ? actionContext.usedFoot : dominantFoot,
        {
          x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
          z: dx * Math.sin(yaw) + dz * Math.cos(yaw),
          height: ball.height,
        },
      );
    }

    // ---- camada superior: tronco e cabeça acompanham a bola
    const attentionX = goalPresentation?.attentionX ?? sim.ball.x;
    const attentionZ = goalPresentation?.attentionZ ?? sim.ball.z;
    const attentionHeight = goalPresentation ? 1.55 : sim.ball.height;
    const toBall = Math.atan2(attentionX - g.position.x, attentionZ - g.position.z);
    let look2 = toBall - g.rotation.y;
    while (look2 > Math.PI) look2 -= Math.PI * 2;
    while (look2 < -Math.PI) look2 += Math.PI * 2;
    const gaze = Math.max(-0.9, Math.min(0.9, look2));
    const ballH = Math.hypot(attentionX - g.position.x, attentionZ - g.position.z);
    const eyeHeight =
      P.hipY + P.hipH * 0.5 + P.spineLen + P.chestLen + P.neckLen + P.headR * 0.96 + p.hipY;
    const gazePitch = ballGazePitch(ballH, attentionHeight, eyeHeight);
    p.headYaw += gaze * 0.75;
    p.chest += Math.min(0.12, gaze * gaze * 0.1);
    p.headPitch += gazePitch;

    // Balance, acceleration and fatigue use the same layer as distant players.
    const tired = 1 - Math.min(1, Math.max(0, player.stamina) / 100);
    refineAthletePosture(p, {
      time: state.clock.elapsedTime,
      phase: motion.phase,
      speed,
      seed,
      stamina: player.stamina,
      accelerationLean: motion.accelerationLean,
      turnRate: motion.turnRate,
      hasAction: Boolean(action),
      defending: sim.possession !== player.side,
    });

    // ---- limites anatômicos
    // Clipe + transição cruzada + IK + olhar + cansaço + inclinação são camadas
    // aditivas: somadas, produziam joelho invertido, tornozelo dobrado ao
    // contrário e ombro atravessando o peito. A trava é a última palavra sobre
    // a pose e também remove qualquer NaN antes que ele vire matriz de osso.
    clampPoseAnatomy(p);

    const actionSupport = footballSupportFor(
      action,
      u,
      P.hipW,
      actionContext.action ? actionContext.usedFoot : dominantFoot,
    );
    cur.current = poseBlender.sample(p, adt, {
      supportFoot:
        actionSupport.plantedFoot ?? (contactL.current >= contactR.current ? "left" : "right"),
      event: selection.actionSeed,
      phase: motion.phase,
      clip: clipName.current,
      action,
      progress: u,
      instant: paused || previewAt !== undefined,
    });
    const c = clampPoseAnatomy(cur.current);

    // ---- contato com o gramado (cinemática direta das duas pernas)
    // Antes a raiz ficava fixa em y = 0 e a sola era "presa" no chão só por
    // construção de `P.hipY`. Bastava agachar, dobrar o joelho ou inclinar o
    // corpo para o pé afundar ou flutuar. Agora medimos onde a sola realmente
    // está e movemos a raiz para plantá-la.
    const support = c.legRPitch - c.legLPitch;
    const shift =
      Math.max(-1, Math.min(1, support)) * 0.045 * Math.min(1, speed / 4) + actionSupport.shiftX;
    const previousShift = hips.current?.position.x ?? 0;
    const hipShiftX = previewAt !== undefined ? shift : supportShiftAt(previousShift, shift, adt);
    const ground = solveGroundContact({
      P,
      pose: c,
      hipShiftX,
      hipRollOffset: shift * 1.2,
      leanX: g.rotation.x,
      leanZ: g.rotation.z,
      airborne: airborneFactor(clipName.current, c.hipY),
      previousRootY: rootY.current,
      dt: previewAt !== undefined ? 1 : adt,
      plantedFoot: actionSupport.plantedFoot,
      bodyContact: actionSupport.bodyContact,
    });
    rootY.current = ground.rootY;
    contactL.current = ground.contactL;
    contactR.current = ground.contactR;
    g.position.y = ground.rootY;
    // a sola do pé apoiado fica paralela ao gramado; o pé no ar mantém o clipe
    c.ankleL += ground.ankleLFix;
    c.ankleR += ground.ankleRFix;
    clampPoseAnatomy(c);

    // ---- aplica nas juntas
    if (hips.current) {
      // transferência de peso: o quadril desliza para o lado da perna de apoio
      hips.current.position.x = hipShiftX;
      hips.current.position.y = P.hipY + c.hipY;
      hips.current.rotation.set(c.hipPitch, c.hipYaw, c.hipRoll + shift * 1.2);
    }
    if (spine.current)
      spine.current.rotation.set(c.spine, -c.hipYaw * 0.45, spineRollForAction(c.hipRoll, action));
    if (chest.current) {
      // postura individual: cada atleta tem um "jeito de carregar o tronco"
      chest.current.rotation.x = c.chest + P.posture;
      chest.current.rotation.y = -c.hipYaw * 0.6;
      // respiração: caixa torácica expande no ritmo; cansado = mais rápido e fundo
      const fatigue = 1 - Math.min(1, Math.max(0, player.stamina) / 100);
      const rate = 1.4 + fatigue * 2.4 + Math.min(1, speed / 7) * 1.2;
      const depth = lod === 0 ? 0.008 + fatigue * 0.022 : 0;
      const b = 1 + Math.sin(state.clock.elapsedTime * rate + seed) * depth;
      chest.current.scale.set(1 + (b - 1) * 0.6, 1 + (b - 1) * 0.3, b);
    }
    if (neck.current) {
      neck.current.rotation.x = c.headPitch;
      neck.current.rotation.y = c.headYaw;
    }
    const leftShoulder = shoulderPose(c.armLPitch, c.armLRoll);
    const rightShoulder = shoulderPose(c.armRPitch, c.armRRoll);
    if (clavLRef.current) {
      clavLRef.current.rotation.x = leftShoulder.clavPitch;
      clavLRef.current.rotation.z = leftShoulder.clavRoll;
    }
    if (clavRRef.current) {
      clavRRef.current.rotation.x = rightShoulder.clavPitch;
      clavRRef.current.rotation.z = rightShoulder.clavRoll;
    }
    if (armLRef.current)
      armLRef.current.rotation.set(
        leftShoulder.armPitch,
        leftShoulder.armYaw,
        leftShoulder.armRoll,
      );
    if (armRRef.current)
      armRRef.current.rotation.set(
        rightShoulder.armPitch,
        rightShoulder.armYaw,
        rightShoulder.armRoll,
      );
    if (foreLRef.current) foreLRef.current.rotation.x = c.elbowL;
    if (foreRRef.current) foreRRef.current.rotation.x = c.elbowR;
    const leftHandPose = handPoseAt(action, u, speed, "L", handBuffers.L);
    const rightHandPose = handPoseAt(action, u, speed, "R", handBuffers.R);
    if (animateDetail) {
      applyHandPose(skin.boneOf, leftHandPose, previewAt !== undefined ? 0.25 : adt, "L");
      applyHandPose(skin.boneOf, rightHandPose, previewAt !== undefined ? 0.25 : adt, "R");
    }
    if (handLRef.current)
      handLRef.current.rotation.set(
        leftHandPose.wrist,
        leftHandPose.pronation + (action ? 0 : 0.06 * Math.sin(motion.phase)),
        leftHandPose.deviation + 0.025,
      );
    if (handRRef.current)
      handRRef.current.rotation.set(
        rightHandPose.wrist,
        -rightHandPose.pronation - (action ? 0 : 0.06 * Math.sin(motion.phase)),
        -rightHandPose.deviation - 0.025,
      );
    // Hidden near buckets do not need expressions, lids or finger motion.
    // Core head tracking and palm/wrist poses continue at the same cadence.
    if (animateDetail) {
      applyRigFacialPresentation({
        speed,
        tired,
        ...(previewAt !== undefined ? { previewAt } : {}),
        t: previewAt !== undefined ? ctx.t : sim.time,
        lookSeed: look.seed,
        seed,
        clip: clipName.current,
        gaze,
        gazePitch,
        adt,
        skin,
        P,
        facialShape,
        facialBuffer: facialBuffer.current,
        jaw: jawRef.current,
        eyes: eyesRef.current,
        upperLeft: eyelidUpperLRef.current,
        upperRight: eyelidUpperRRef.current,
        lowerLeft: eyelidLowerLRef.current,
        lowerRight: eyelidLowerRRef.current,
      });
    }

    if (legLRef.current) legLRef.current.rotation.set(c.legLPitch, 0, c.legLRoll);
    if (legRRef.current) legRRef.current.rotation.set(c.legRPitch, 0, c.legRRoll);
    if (kneeLRef.current) kneeLRef.current.rotation.x = -c.kneeL;
    if (kneeRRef.current) kneeRRef.current.rotation.x = -c.kneeR;
    if (ankleLRef.current) ankleLRef.current.rotation.x = c.ankleL;
    if (ankleRRef.current) ankleRRef.current.rotation.x = c.ankleR;
    updateRigCorrectives(skin.boneOf);
    const clothElapsed =
      lastClothTime.current === null
        ? rawDt
        : Math.max(0, state.clock.elapsedTime - lastClothTime.current);
    lastClothTime.current = state.clock.elapsedTime;
    clothInput.x = player.vx * Math.cos(motion.yaw) - player.vz * Math.sin(motion.yaw);
    clothInput.z = motion.forward;
    clothInput.lift = Math.max(0, c.hipY + ground.rootY);
    clothInput.effort = Math.min(1, dirLen / 8);
    clothInput.bend = Math.abs(c.spine) + Math.abs(c.legLPitch - c.legRPitch) * 0.22;
    clothInput.yaw = motion.yaw;
    clothInput.roll = c.hipRoll;
    clothInput.wet = wet;
    clothInput.contact = clothContactPulse(player.action, player.actionT, player.actionDur);
    clothInput.legL = Math.min(1, Math.abs(c.kneeL) * 0.58 + Math.abs(c.legLPitch) * 0.24);
    clothInput.legR = Math.min(1, Math.abs(c.kneeR) * 0.58 + Math.abs(c.legRPitch) * 0.24);
    cloth.update(paused ? 0 : clothElapsed, clothInput);
    // A paused demand-rendered pose is cached only after reaching the bones;
    // a skipped cadence sample must never freeze the preceding clip.
    sampled.current = previewAt;
    painted.current = true;
    onPoseReady?.(skin);

    // ---- sombra de contato acompanha a altura do quadril
    if (shadowRef.current) {
      // A sombra de contato segue o apoio real, não mais um palpite pelo
      // quadril: no ar ela encolhe e desbota, na base aberta ela alarga.
      const contact = Math.max(ground.contactL, ground.contactR);
      const lift = Math.max(0, ground.rootY);
      const s = (1 - lift * 0.55) * (0.72 + 0.28 * contact) * (1 + ground.stanceSpread * 0.35);
      shadowRef.current.scale.setScalar(Math.max(0.35, s));
      // a sombra vive no gramado, não na raiz inclinada/erguida do atleta
      shadowRef.current.position.y = -ground.rootY + 0.012;
      shadowRef.current.rotation.set(-Math.PI / 2 - g.rotation.x, 0, -g.rotation.z);
      const m = shadowRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.36 * Math.max(0.18, contact) * (1 - Math.min(0.7, lift));
    }
  });
}
