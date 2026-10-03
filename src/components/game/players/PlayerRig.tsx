// ============================================================================
//  PlayerRig.tsx
//  Malha 3D articulada dos jogadores.
//
//  A anatomia vem de `@/game/player-model` (determinística por id) e a pose
//  vem do catálogo procedural de `@/game/animation`. Cada articulação é um
//  <group> com pivô no lugar certo: quadril, lombar, peito, pescoço, ombro,
//  cotovelo, punho, joelho e tornozelo. Nada gira mais pelo centro da peça.
//
//  Custo: as malhas de cada junta são mescladas por material em
//  `@/game/rig-body` (um atleta sai de ~117 para ~45 malhas em LOD 0), três
//  níveis de LOD trocados por distância de câmera, avaliação de animação em
//  taxa reduzida longe da câmera e materiais simplificados fora do modo "alta".
// ============================================================================

import { useFrame, useThree } from "@react-three/fiber";
import type React from "react";
import { createElement, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  emptyPose,
  getClip,
  mixPose,
  selectClip,
  type ClipName,
  type Pose,
} from "@/game/animation";
import { expressionFor } from "@/game/animation-extra3";
import { ballGazePitch, emptyFacialPose, facialPoseAt } from "@/game/facial-animation";
import { kitTextureFor } from "@/game/graphics/kit-atlas";
import { useMatchSurface } from "@/game/graphics/surface-context";
import type { Kit } from "@/game/kits";
import {
  detailTextureNames,
  playerMaterials,
  retainPlayerMaterials,
} from "@/game/player-materials";
import { onKtx2Ready, requestKtx2 } from "@/game/textures/ktx2";
import { visualDataFor } from "@/game/visual-frame-cache";
import { useVisual } from "@/game/visual-settings";
import {
  lodForDistance,
  lookFor,
  lookWithPhysique,
  proportionsFor,
  segmentsFor,
  shade,
  type LodLevel,
  type PlayerLook,
} from "@/game/player-model";
import { type SimView, type SimPlayer } from "@/game/sim";
import {
  emptyActionContext,
  emptyContactContext,
  getDominantFoot,
  type ActionContext,
  type ContactContext,
  type VisualState,
  type DominantFoot,
} from "@/game/visual-context";
import { solveFullIK } from "@/game/ik-solver";
import {
  buildRigSkin,
  rebindRigSkinMaterials,
  type RigJoint,
  type RigSkin,
  type RigSkinLod,
} from "@/game/rig-skin";
import { spineRollForAction, updateRigCorrectives } from "@/game/rig-correctives";
import { faceMorphology } from "@/game/player-morphology";
import { AthleteCloth } from "@/game/athlete-cloth";
import { censusRef } from "@/game/scene-census";
import { airborneFactor, clampPoseAnatomy, solveGroundContact } from "@/game/ground-contact";
import { gaitPoseAt, locomotionWeight } from "@/game/gait-kinematics";
import { visualMotionFor } from "@/game/visual-motion";
import { footballSupportFor, refineFootballAction, refineBallFootContact } from "@/game/football-action";
import { refineAthletePosture, shoulderPose } from "@/game/athlete-posture";
import { applyHandPose, handPoseAt } from "@/game/player-hands";
import { AthletePoseBlender } from "@/game/athlete-pose-blender";

/**
 * Velocidade (m/s) para a qual cada ciclo de passada foi desenhado. A cadência
 * do clipe é reescalada pela velocidade real do atleta, de modo que o pé de
 * apoio acompanhe o deslocamento no gramado em vez de patinar.
 */
const GAIT_SPEED: Record<string, number> = {
  walk: 1.6,
  stroll: 1.3,
  walkTalk: 1.5,
  tired: 1.5,
  exhaustedWalk: 1.2,
  limp: 1.1,
  skipStep: 2.2,
  jog: 3.4,
  joggingBack: 3.0,
  runRelaxed: 4.6,
  checkShoulder: 4.4,
  run: 5.5,
  curveRunLeft: 5.8,
  curveRunRight: 5.8,
  sprint: 7.6,
  sprintFlatOut: 8.2,
  sprintEasing: 6.6,
  recoverySprint: 8.0,
};

export type Quality = "alta" | "media" | "baixa";

/* -------------------------------------------------------------------------- */

interface RigProps {
  player: SimPlayer;
  sim: SimView;
  kit: Kit;
  goalPulse: React.MutableRefObject<number>;
  quality: Quality;
  paused?: boolean;
  respectVisualSettings?: boolean;
  /** Optional studio sampling; ordinary match playback always uses its clock. */
  previewAt?: number | undefined;
  /** Studio-only presentation override; never changes the simulation/save. */
  lookOverride?: PlayerLook | undefined;
  previewClip?: ClipName | undefined;
  /** Dense face topology is reserved for the isolated portrait preview. */
  portrait?: boolean;
  clothPhysics?: boolean;
  /** Inspection cameras follow actual posed bones, never simulation positions. */
  onPoseReady?: ((skin: RigSkin) => void) | undefined;
}

export const PlayerRig = memo(function PlayerRig({
  player,
  sim,
  kit,
  goalPulse,
  lookOverride,
  portrait = false,
  clothPhysics = true,
  previewClip,
  quality: baseQuality,
  paused = false,
  respectVisualSettings = true,
  previewAt,
  onPoseReady,
}: RigProps) {
  // O usuário pode forçar mais ou menos detalhe na página /visual.
  const detail = useVisual().playerDetail;
  const quality: Quality = !respectVisualSettings
    ? baseQuality
    : detail === "detalhado"
      ? "alta"
      : detail === "simples"
        ? "baixa"
        : baseQuality;

  /* ---------------------------------------------------------- contexto visual */
  const playerIndex = useMemo(
    () => sim.players.findIndex((candidate) => candidate.id === player.id),
    [sim.players, player.id],
  );

  // Determina pé dominante do jogador
  const dominantFoot: DominantFoot = getDominantFoot(player.pid);

  /* ------------------------------------------------------------ aparência */

  const look = useMemo(
    () =>
      lookOverride ??
      lookWithPhysique(lookFor(player.pid, player.pos, player.number === 10), {
        height: player.heightCm,
        weight: player.weightKg,
      }),
    [lookOverride, player.pid, player.pos, player.number, player.heightCm, player.weightKg],
  );
  const facialShape = useMemo(() => faceMorphology(look.seed), [look.seed]);
  const P = useMemo(() => proportionsFor(look), [look]);
  // Só os atletas com rig completo (perto da câmera) recebem a camisa em 512²
  // com nome; o resto do campo usa a versão de 128².
  const surface = useMatchSurface();
  const tex = useMemo(
    () => kitTextureFor(kit, player.number, player.name, { lod: 0, quality }),
    [kit, player.number, player.name, quality],
  );

  // Cor de identificação que contrasta com a camisa.
  const jerseyInk = useMemo(() => {
    const h = kit.base.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l > 0.55 ? "#101418" : "#f5f5f2";
  }, [kit.base]);

  const isGK = player.pos === "GK";
  const hi = quality === "alta";
  const shadows = quality === "alta";
  const invalidate = useThree((state) => state.invalidate);
  // Demand-rendered studio previews still display newly loaded maps while
  // paused. Match playback needs no React updates for texture streaming.
  useEffect(() => {
    if (paused) return onKtx2Ready(invalidate);
    return undefined;
  }, [paused, invalidate]);

  /* -------------------------------------------------------------- juntas */

  const root = useRef<THREE.Group>(null);
  // As juntas são ossos (`THREE.Bone`) do esqueleto do atleta: a animação
  // escreve neles exatamente como escrevia nos grupos, e a malha é rendida
  // como SkinnedMesh — um desenho por grupo de material em vez de um por peça.
  const hips = useRef<THREE.Bone>(null);
  const spine = useRef<THREE.Bone>(null);
  const chest = useRef<THREE.Bone>(null);
  const neck = useRef<THREE.Bone>(null);
  const armLRef = useRef<THREE.Bone>(null);
  const armRRef = useRef<THREE.Bone>(null);
  const foreLRef = useRef<THREE.Bone>(null);
  const foreRRef = useRef<THREE.Bone>(null);
  const handLRef = useRef<THREE.Bone>(null);
  const handRRef = useRef<THREE.Bone>(null);
  const legLRef = useRef<THREE.Bone>(null);
  const legRRef = useRef<THREE.Bone>(null);
  const kneeLRef = useRef<THREE.Bone>(null);
  const kneeRRef = useRef<THREE.Bone>(null);
  const ankleLRef = useRef<THREE.Bone>(null);
  const ankleRRef = useRef<THREE.Bone>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const blinkRef = useRef<THREE.Bone>(null);
  const clavLRef = useRef<THREE.Bone>(null);
  const clavRRef = useRef<THREE.Bone>(null);
  const jawRef = useRef<THREE.Bone>(null);
  const eyesRef = useRef<THREE.Bone>(null);
  const facialBuffer = useRef(emptyFacialPose());

  // LOD por grupo de desenho: os grupos "near" (rosto, dedos) somem a partir
  // do LOD 1 e os "boot" (travas) a partir do LOD 2 — a maioria dos 22
  // atletas fica longe da câmera na maior parte do tempo.
  const nearMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const bootMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const skinnedMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const lodState = useRef<LodLevel | null>(null);
  const castState = useRef<boolean | null>(null);

  /* ---------------------------------------------------------- animação */

  const cur = useRef<Pose>(emptyPose());
  const poseBlender = useRef(new AthletePoseBlender());
  const blendBuf = useRef<Pose>(emptyPose());
  const ikBuf = useRef<Pose>(emptyPose());
  const clipName = useRef<ClipName>("idle");
  const clipTime = useRef(0);
  const acc = useRef(0);
  // tempo acumulado abaixo do limiar de caminhada, para decidir clipes de parada
  const idleFor = useRef(0);
  const accelerationLean = useRef(0);
  const seed = look.seed % 97;
  // estado do plantio de pé entre quadros (ver `@/game/ground-contact`)
  const rootY = useRef(0);
  const contactL = useRef(1);
  const contactR = useRef(1);
  const gaitBuffer = useRef(emptyPose());
  const painted = useRef(false);
  const sampled = useRef<number | undefined>(undefined);

  useFrame((state, rawDt) => {
    if (paused && painted.current && sampled.current === previewAt) {
      // A paused pose still serves a changed inspection camera. Do not
      // re-run animation or smoothing just to switch from body to gloves.
      onPoseReady?.(skin);
      return;
    }
    sampled.current = previewAt;
    painted.current = true;
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);

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
      acc.current = 0;
      return;
    }

    // ---- LOD por distância
    const camDist = Math.sqrt(dist2);
    const lod = lodForDistance(camDist, quality);
    if (lod !== lodState.current) {
      const first = lodState.current === null;
      lodState.current = lod;
      for (const mesh of nearMeshes.current) mesh.visible = lod === 0;
      for (const mesh of bootMeshes.current) mesh.visible = lod <= 1;

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
    g.rotation.set(motion.leanX, motion.yaw, motion.leanZ, "YXZ");
    accelerationLean.current = motion.accelerationLean;

    // ---- passo de animação em taxa reduzida longe da câmera
    const step = lod === 0 ? 0 : lod === 1 ? 1 / 36 : 1 / 16;
    acc.current += dt;
    if (acc.current < step) return;
    const adt = acc.current;
    acc.current = 0;

    const speed = dirLen;
    // histerese: só é "parado" depois de ~0,25 s praticamente sem deslocamento,
    // e volta a "em movimento" assim que anda de verdade (evita piscar clipes).
    if (speed < 0.45) idleFor.current += adt;
    else if (speed > 0.9) idleFor.current = 0;
    const stopped = idleFor.current > 0.25;

    const next =
      previewClip ??
      selectClip({
        isGK,
        action: player.action,
        speed,
        hasBall: sim.ball.holder === player.id,
        ballDist: Math.hypot(sim.ball.x - player.x, sim.ball.z - player.z),
        stamina: player.stamina,
        defending: sim.possession !== player.side,
        stopped,
        seed,
        time: sim.time,
      });

    if (next !== clipName.current) {
      clipName.current = next;
      clipTime.current = 0;
    }
    // ---- cadência sincronizada com o deslocamento real (sem patinar)
    const nominal = GAIT_SPEED[clipName.current];
    const cadence = nominal ? Math.max(0.55, Math.min(1.7, speed / nominal)) : 1;
    clipTime.current += adt * cadence;

    const u =
      previewAt ??
      (player.action && player.actionDur > 0
        ? 1 - Math.max(0, player.actionT) / player.actionDur
        : (clipTime.current % 1.4) / 1.4);

    const ctx = {
      t: previewAt !== undefined ? previewAt * (player.actionDur || 1.4) : clipTime.current,
      u,
      speed,
      stride: Math.min(1, speed / 7),
      seed,
    };
    let p = getClip(clipName.current)(ctx);

    const gaitWeight = locomotionWeight(speed, player.action, clipName.current);
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
      visualCtx?.actionContexts[playerIndex] ?? emptyActionContext();
    const contactContext: ContactContext =
      visualCtx?.contactContexts[playerIndex] ?? emptyContactContext();
    if (visualCtx && lod === 0 && player.action) {
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
      player.action,
      u,
      P,
      actionContext.action ? actionContext.usedFoot : dominantFoot,
    );
    if (player.action && lod === 0) {
      const ball = sim.visualBall ?? sim.ball;
      const dx = ball.x - g.position.x, dz = ball.z - g.position.z;
      const yaw = motion.yaw;
      refineBallFootContact(p, player.action, u, P,
        actionContext.action ? actionContext.usedFoot : dominantFoot,
        { x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
          z: dx * Math.sin(yaw) + dz * Math.cos(yaw), height: ball.height });
    }

    // ---- camada superior: tronco e cabeça acompanham a bola
    const toBall = Math.atan2(sim.ball.x - player.x, sim.ball.z - player.z);
    let look2 = toBall - g.rotation.y;
    while (look2 > Math.PI) look2 -= Math.PI * 2;
    while (look2 < -Math.PI) look2 += Math.PI * 2;
    const gaze = Math.max(-0.9, Math.min(0.9, look2));
    const ballH = Math.hypot(sim.ball.x - player.x, sim.ball.z - player.z);
    const eyeHeight =
      P.hipY + P.hipH * 0.5 + P.spineLen + P.chestLen + P.neckLen + P.headR * 0.96 + p.hipY;
    const gazePitch = ballGazePitch(ballH, sim.ball.height, eyeHeight);
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
      hasAction: Boolean(player.action),
      defending: sim.possession !== player.side,
    });

    // ---- limites anatômicos
    // Clipe + transição cruzada + IK + olhar + cansaço + inclinação são camadas
    // aditivas: somadas, produziam joelho invertido, tornozelo dobrado ao
    // contrário e ombro atravessando o peito. A trava é a última palavra sobre
    // a pose e também remove qualquer NaN antes que ele vire matriz de osso.
    clampPoseAnatomy(p);

    cur.current = poseBlender.current.sample(p, adt, {
      clip: clipName.current,
      action: player.action,
      progress: u,
      instant: paused || previewAt !== undefined,
    });
    const c = clampPoseAnatomy(cur.current);

    // ---- contato com o gramado (cinemática direta das duas pernas)
    // Antes a raiz ficava fixa em y = 0 e a sola era "presa" no chão só por
    // construção de `P.hipY`. Bastava agachar, dobrar o joelho ou inclinar o
    // corpo para o pé afundar ou flutuar. Agora medimos onde a sola realmente
    // está e movemos a raiz para plantá-la.
    const actionSupport = footballSupportFor(
      player.action,
      u,
      P.hipW,
      actionContext.action ? actionContext.usedFoot : dominantFoot,
    );
    const support = c.legRPitch - c.legLPitch;
    const shift =
      Math.max(-1, Math.min(1, support)) * 0.045 * Math.min(1, speed / 4) + actionSupport.shiftX;
    const previousShift = hips.current?.position.x ?? 0;
    const hipShiftX =
      previewAt !== undefined
        ? shift
        : previousShift + (shift - previousShift) * Math.min(1, adt * 14);
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
      spine.current.rotation.set(
        c.spine,
        -c.hipYaw * 0.45,
        spineRollForAction(c.hipRoll, player.action),
      );
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
    const leftHandPose = handPoseAt(player.action, u, speed, "L");
    const rightHandPose = handPoseAt(player.action, u, speed, "R");
    if (lod === 0) {
      applyHandPose(skin.boneOf, leftHandPose, previewAt !== undefined ? 0.25 : adt, "L");
      applyHandPose(skin.boneOf, rightHandPose, previewAt !== undefined ? 0.25 : adt, "R");
    }
    if (handLRef.current)
      handLRef.current.rotation.set(
        leftHandPose.wrist,
        leftHandPose.pronation + (player.action ? 0 : 0.06 * Math.sin(motion.phase)),
        leftHandPose.deviation + 0.025,
      );
    if (handRRef.current)
      handRRef.current.rotation.set(
        rightHandPose.wrist,
        -rightHandPose.pronation - (player.action ? 0 : 0.06 * Math.sin(motion.phase)),
        -rightHandPose.deviation - 0.025,
      );
    // ---- rosto: expressão do clipe + esforço (só no LOD 0, onde há rosto)
    if (lod === 0) {
      const effort = Math.min(1, speed / 7);
      const expr = expressionFor(clipName.current, effort, tired);
      const facePose = facialPoseAt(
        previewAt !== undefined ? ctx.t : sim.time,
        look.seed,
        expr,
        gaze,
        gazePitch,
        effort,
        facialBuffer.current,
      );
      const faceResponse = previewAt !== undefined ? 1 : 1 - Math.exp(-18 * adt);
      const celebrating = /celebrat|fist|victory|applaud|hug/i.test(clipName.current);
      const protesting = /protest|argue|complain/i.test(clipName.current);
      const browLift =
        P.headR * (celebrating ? 0.035 : protesting ? -0.012 : -effort * 0.01 - tired * 0.006);
      const browTilt = celebrating ? -0.035 : protesting ? 0.12 : effort * 0.06;
      for (const side of ["L", "R"] as const) {
        const brow = side === "L" ? skin.boneOf.browL : skin.boneOf.browR;
        const response = previewAt !== undefined ? 1 : 1 - Math.exp(-12 * adt);
        const sideSign = side === "L" ? 1 : -1;
        brow.position.y +=
          (P.headR * (0.31 + facialShape.browAsymmetry * sideSign) + browLift - brow.position.y) *
          response;
        brow.rotation.z += ((side === "L" ? 1 : -1) * browTilt - brow.rotation.z) * response;
      }
      // Jaw, eyelids and saccades share the match clock and freeze with the pose.
      if (jawRef.current) {
        jawRef.current.rotation.x += (facePose.jaw - jawRef.current.rotation.x) * faceResponse;
      }
      if (eyesRef.current) {
        eyesRef.current.position.x +=
          (facePose.eyeX * P.headR * 0.055 - eyesRef.current.position.x) * faceResponse;
        eyesRef.current.position.y +=
          (facePose.eyeY * P.headR * 0.045 - eyesRef.current.position.y) * faceResponse;
      }
      if (blinkRef.current) {
        blinkRef.current.scale.y += (facePose.lidClosure - blinkRef.current.scale.y) * faceResponse;
      }
    }

    if (legLRef.current) legLRef.current.rotation.set(c.legLPitch, 0, c.legLRoll);
    if (legRRef.current) legRRef.current.rotation.set(c.legRPitch, 0, c.legRRoll);
    if (kneeLRef.current) kneeLRef.current.rotation.x = -c.kneeL;
    if (kneeRRef.current) kneeRRef.current.rotation.x = -c.kneeR;
    if (ankleLRef.current) ankleLRef.current.rotation.x = c.ankleL;
    if (ankleRRef.current) ankleRRef.current.rotation.x = c.ankleR;
    updateRigCorrectives(skin.boneOf);
    cloth.update(paused ? 0 : adt, {
      x: player.vx * Math.cos(motion.yaw) - player.vz * Math.sin(motion.yaw),
      z: motion.forward,
      lift: Math.max(0, c.hipY + ground.rootY),
      effort: Math.min(1, dirLen / 8),
      bend: Math.abs(c.spine) + Math.abs(c.legLPitch - c.legRPitch) * 0.22,
      yaw: motion.yaw,
      roll: c.hipRoll,
    });
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

  /* ------------------------------------------------------------ materiais */

  // A qualidade baixa usava a mesma malha de 14 segmentos da alta nos 22
  // jogadores. Ajustar a geometria ao nível global reduz muito o trabalho da
  // GPU sem alterar silhueta, materiais ou animações.
  const segs = segmentsFor(quality === "alta" ? 0 : quality === "media" ? 1 : 2);

  // Materiais compartilhados entre jogadores com a mesma combinação de
  // uniforme/aparência: derruba o número de programas de shader e de objetos
  // de material de ~200 para poucas dezenas numa partida.
  useEffect(() => {
    if (quality !== "alta") return;
    requestKtx2(detailTextureNames(look, kit));
  }, [quality, kit, look]);
  const mats = useMemo(
    () => playerMaterials(look, kit, tex ?? null, quality, surface),
    [look, kit, tex, quality, surface],
  );
  useLayoutEffect(() => retainPlayerMaterials(mats), [mats]);

  // Corpo em SkinnedMesh: um desenho por grupo de material (~18) em vez de um
  // por peça mesclada (~53). A matriz de bind é a posição do atleta, porque
  // ossos e malhas são filhos do mesmo grupo raiz. Reconstruído só quando
  // aparência ou qualidade mudam.
  const skin = useMemo<RigSkin>(
    () =>
      buildRigSkin(
        {
          P,
          look,
          segs: { radial: segs.radial, cap: segs.cap },
          hi,
          portrait,
          mats,
          jerseyInk,
          handR: look.gloves ? P.handR * 1.25 : P.handR,
          handMat: look.gloves ? mats.glove : mats.skin,
        },
        [player.x, 0, player.z],
      ),
    // `player.x/z` ficam de propósito: a matriz de bind defasada é compensada
    // pelo three.js a cada quadro, e incluí-los aqui reconstruiria as 18 malhas
    // do atleta a cada movimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [P, look, kit, segs.radial, segs.cap, hi, portrait, jerseyInk],
  );
  useEffect(() => () => skin.dispose(), [skin]);
  const cloth = useMemo(
    () => new AthleteCloth(skin, P, hi && clothPhysics),
    [skin, P, hi, clothPhysics],
  );
  useLayoutEffect(() => {
    painted.current = false;
    lodState.current = null;
    castState.current = null;
    // The first sample sets a deterministic expression on each rebuilt skin.
    skin.boneOf.blink.scale.y = 0.001;
  }, [skin, look.seed]);

  // As malhas são criadas fora do JSX para carregar esqueleto, esfera de
  // culling generosa (a pose animada sai da pose de bind) e o estado de LOD.
  const drawMeshes = useMemo(() => {
    nearMeshes.current = [];
    bootMeshes.current = [];
    skinnedMeshes.current = [];
    return skin.groups.map((group, index) => {
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
      // The portrait camera can sit beside an overhead glove, far outside
      // that detail bucket's rest-pose bounds. The single inspected athlete
      // stays visible; ordinary match players retain frustum culling.
      mesh.frustumCulled = !portrait;
      // Sem esqueleto e matriz de bind a malha não deforma (e apareceria
      // deslocada). `bindMatrixInverse` é mantido pelo three.js a cada quadro.
      mesh.skeleton = skin.skeleton;
      mesh.bindMatrix.copy(skin.bindMatrix);
      mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
      // Só o corpo projetа sombra. Rosto, dedos e travas são pequenos demais
      // para aparecer no mapa de sombras e custariam uma segunda passagem de
      // desenho por atleta — 6 grupos a menos por herói.
      mesh.castShadow = shadows && group.castShadow && group.lod === "core";
      mesh.receiveShadow = false;
      mesh.name = `rig-${group.lod}`;
      // esfera local folgada: evita o recálculo caro (e animado) do three.js
      const sphere = group.geometry.boundingSphere;
      if (sphere) mesh.boundingSphere = sphere.clone();
      if (group.lod === "near") nearMeshes.current.push(mesh);
      if (group.lod === "boot") bootMeshes.current.push(mesh);
      skinnedMeshes.current.push(mesh);
      return createElement("primitive", { key: `${group.material.uuid}-${index}`, object: mesh });
    });
  }, [skin, shadows, portrait]);

  // Material maps/surface steps change far more often than body geometry.
  // Rebind their stable slots in place and keep the mesh and skeleton objects.
  useLayoutEffect(() => {
    rebindRigSkinMaterials(skin, skinnedMeshes.current, mats);
  }, [skin, mats, drawMeshes]);
  useLayoutEffect(() => {
    for (const mesh of skinnedMeshes.current) {
      cloth.bind(mesh);
      if (!hi || !clothPhysics) mesh.morphTargetInfluences?.fill(0);
    }
  }, [skin, cloth, drawMeshes, hi, clothPhysics]);

  // Junta -> osso. `createElement` (e não JSX) de propósito: o plugin de
  // desenvolvimento injeta atributos de origem no JSX e o R3F não aceita isso
  // num <primitive>.
  // Só as juntas que a animação escreve precisam de ref; as demais existem na
  // hierarquia para carregar a geometria dos grupos de LOD.
  const boneRefs: Partial<Record<RigJoint, React.RefObject<THREE.Bone | null>>> = {
    hips,
    spine,
    chest,
    neck,
    jaw: jawRef,
    eyes: eyesRef,
    blink: blinkRef,
    clavL: clavLRef,
    armL: armLRef,
    foreL: foreLRef,
    handL: handLRef,
    clavR: clavRRef,
    armR: armRRef,
    foreR: foreRRef,
    handR: handRRef,
    legL: legLRef,
    kneeL: kneeLRef,
    ankleL: ankleLRef,
    legR: legRRef,
    kneeR: kneeRRef,
    ankleR: ankleRRef,
  };
  /*
    A R3F só recebe o osso raiz: renderizar os 25 como irmãos achataria a
    hierarquia (o `add()` do three.js moveria cada osso para o grupo raiz). Os
    filhos já estão ligados em `skin`, então a cena fica correta com um único
    elemento; os refs da animação são ligados aqui.
  */
  useLayoutEffect(() => {
    const entries = Object.entries(boneRefs) as [RigJoint, React.RefObject<THREE.Bone | null>][];
    for (const [joint, ref] of entries) ref.current = skin.boneOf[joint] ?? null;
    return () => {
      for (const [, ref] of entries) ref.current = null;
    };
  });
  const renderBones = () => [createElement("primitive", { key: "skeleton", object: skin.root })];

  /* ------------------------------------------------------------- render */

  return (
    <group
      ref={(el) => {
        root.current = el;
        censusRef("player")(el);
      }}
      position={[player.x, 0, player.z]}
    >
      {/* sombra de contato */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.36, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/*
        Esqueleto: um osso por junta, com o mesmo pivô e a mesma hierarquia dos
        grupos de antes. A animação continua escrevendo rotação, posição e
        escala nos mesmos lugares — só que agora isso deforma os vértices.
      */}
      {renderBones()}

      {/* malhas: um desenho por grupo de material, todas skinned */}
      {drawMeshes}
    </group>
  );
});

export default PlayerRig;
