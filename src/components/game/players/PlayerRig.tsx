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

import { useFrame } from "@react-three/fiber";
import type React from "react";
import { createElement, memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  emptyPose,
  getClip,
  mixPose,
  selectClip,
  type ClipName,
  type Pose,
} from "@/game/animation";
import { kitTexture, type Kit } from "@/game/kits";
import { playerMaterials } from "@/game/player-materials";
import { requestKtx2, useKtx2Revision, type DetailKtx2Name } from "@/game/textures/ktx2";
import { visualDataFor } from "@/game/visual-frame-cache";
import { useVisual } from "@/game/visual-settings";
import {
  lodForDistance,
  lookFor,
  proportionsFor,
  segmentsFor,
  shade,
  type LodLevel,
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
import { buildRigSkin, type RigJoint, type RigSkin, type RigSkinLod } from "@/game/rig-skin";
import { censusRef } from "@/game/scene-census";

/** duração da transição cruzada entre dois movimentos, em segundos */
const BLEND_TIME = 0.18;
// quintic smootherstep: velocidade e aceleração zero nas pontas da transição
const ease = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

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
}

export const PlayerRig = memo(function PlayerRig({
  player,
  sim,
  kit,
  goalPulse,
  quality: baseQuality,
}: RigProps) {
  // O usuário pode forçar mais ou menos detalhe na página /visual.
  const detail = useVisual().playerDetail;
  const quality: Quality =
    detail === "detalhado" ? "alta" : detail === "simples" ? "baixa" : baseQuality;

  /* ---------------------------------------------------------- contexto visual */
  const playerIndex = useMemo(
    () => sim.players.findIndex((candidate) => candidate.id === player.id),
    [sim.players, player.id],
  );

  // Determina pé dominante do jogador
  const dominantFoot: DominantFoot = getDominantFoot(player.pid);

  /* ------------------------------------------------------------ aparência */

  const look = useMemo(
    () => lookFor(player.id, player.pos, player.number === 10),
    [player.id, player.pos, player.number],
  );
  const P = useMemo(() => proportionsFor(look), [look]);
  const tex = useMemo(
    () => kitTexture(kit, player.number, player.name),
    [kit, player.number, player.name],
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
  const nextBlink = useRef(1 + Math.random() * 4);

  // LOD por grupo de desenho: os grupos "near" (rosto, dedos) somem a partir
  // do LOD 1 e os "boot" (travas) a partir do LOD 2 — a maioria dos 22
  // atletas fica longe da câmera na maior parte do tempo.
  const nearMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const bootMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const lodState = useRef<LodLevel | null>(null);
  const castState = useRef<boolean | null>(null);

  /* ---------------------------------------------------------- animação */

  const cur = useRef<Pose>(emptyPose());
  const target = useRef<Pose>(emptyPose());
  const blendBuf = useRef<Pose>(emptyPose());
  const ikBuf = useRef<Pose>(emptyPose());
  const clipName = useRef<ClipName>("idle");
  const prevName = useRef<ClipName | null>(null);
  const clipTime = useRef(0);
  const prevTime = useRef(0);
  const blend = useRef(1);
  const acc = useRef(0);
  // tempo acumulado abaixo do limiar de caminhada, para decidir clipes de parada
  const idleFor = useRef(0);
  const previousVx = useRef(player.vx);
  const previousVz = useRef(player.vz);
  const accelerationLean = useRef(0);
  const seed = look.seed % 97;

  useFrame((state, rawDt) => {
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
    const dirLen = Math.hypot(player.vx, player.vz);
    let want = g.rotation.y;
    if (dirLen > 0.5) {
      want = Math.atan2(player.vx, player.vz);
    } else {
      want = Math.atan2(sim.ball.x - player.x, sim.ball.z - player.z);
    }
    let d = want - g.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const turnBlend = 1 - Math.exp(-(dirLen > 0.5 ? 13 : 5) * dt);
    const turnRate = d * turnBlend;
    g.rotation.y += turnRate;

    // ---- inclinação do corpo: para a frente na aceleração, para dentro na curva
    // usa velocidade angular (rad/s), não o passo do quadro: assim a inclinação
    // é a mesma a 30, 60 ou 120 quadros por segundo (antes variava e tremia)
    const yawRate = dt > 0 ? turnRate / dt : 0;
    const forwardX = Math.sin(g.rotation.y);
    const forwardZ = Math.cos(g.rotation.y);
    const accelerationX = (player.vx - previousVx.current) / Math.max(dt, 1 / 120);
    const accelerationZ = (player.vz - previousVz.current) / Math.max(dt, 1 / 120);
    previousVx.current = player.vx;
    previousVz.current = player.vz;
    const forwardAcceleration = accelerationX * forwardX + accelerationZ * forwardZ;
    const accelerationTarget = Math.max(-0.09, Math.min(0.12, forwardAcceleration * 0.012));
    accelerationLean.current +=
      (accelerationTarget - accelerationLean.current) * (1 - Math.exp(-9 * dt));
    const leanF = Math.min(0.22, dirLen * 0.026) + accelerationLean.current;
    const leanS = Math.max(-0.3, Math.min(0.3, -yawRate * 0.09 * Math.min(1, dirLen / 5)));
    const leanBlend = 1 - Math.exp(-7 * dt);
    g.rotation.x += (leanF - g.rotation.x) * leanBlend;
    g.rotation.z += (leanS - g.rotation.z) * leanBlend;

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

    const next = selectClip({
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
      if (blend.current < 0.5 && prevName.current && prevName.current !== next) {
        // troca no meio de uma transição: o clipe anterior ainda domina a pose,
        // então ele continua como origem e só o destino muda (sem "estalo").
        clipName.current = next;
        clipTime.current = 0;
      } else {
        // guarda o clipe anterior para fazer a transição cruzada
        prevName.current = clipName.current;
        prevTime.current = clipTime.current;
        clipName.current = next;
        clipTime.current = 0;
        blend.current = 0;
      }
    }
    // ---- cadência sincronizada com o deslocamento real (sem patinar)
    const nominal = GAIT_SPEED[clipName.current];
    const cadence = nominal ? Math.max(0.55, Math.min(1.7, speed / nominal)) : 1;
    const prevNominal = prevName.current ? GAIT_SPEED[prevName.current] : undefined;
    const prevCadence = prevNominal ? Math.max(0.55, Math.min(1.7, speed / prevNominal)) : 1;
    clipTime.current += adt * cadence;
    prevTime.current += adt * prevCadence;
    // troca entre andar/correr pede mistura mais longa; ação com bola, mais curta
    // correr→parar desacelera o corpo mais devagar; parado→correr arranca rápido
    const stoppingFromGait = !nominal && prevNominal !== undefined && !player.action;
    const blendTime = player.action
      ? BLEND_TIME * 0.6
      : stoppingFromGait
        ? BLEND_TIME * 1.8
        : nominal
          ? BLEND_TIME * 1.4
          : BLEND_TIME;
    blend.current = Math.min(1, blend.current + adt / blendTime);

    const u =
      player.action && player.actionDur > 0
        ? 1 - Math.max(0, player.actionT) / player.actionDur
        : (clipTime.current % 1.4) / 1.4;

    const ctx = {
      t: clipTime.current,
      u,
      speed,
      stride: Math.min(1, speed / 7),
      seed,
    };
    let p = getClip(clipName.current)(ctx);

    // ---- transição cruzada com o clipe anterior (nada de troca seca)
    if (blend.current < 1 && prevName.current) {
      const prev = getClip(prevName.current)({
        ...ctx,
        t: prevTime.current,
        u: (prevTime.current % 1.4) / 1.4,
      });
      p = mixPose(prev, p, ease(blend.current), blendBuf.current);
    }

    // ---- IK contextual compartilhado: o contexto é gerado uma vez por
    // snapshot e reutilizado por todos os atletas, sem ficar obsoleto.
    const visualCtx = visualDataFor(sim);
    const actionContext: ActionContext =
      visualCtx?.actionContexts[playerIndex] ?? emptyActionContext();
    const contactContext: ContactContext =
      visualCtx?.contactContexts[playerIndex] ?? emptyContactContext();
    if (visualCtx && lod === 0) {
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

    // ---- camada superior: tronco e cabeça acompanham a bola
    const toBall = Math.atan2(sim.ball.x - player.x, sim.ball.z - player.z);
    let look2 = toBall - g.rotation.y;
    while (look2 > Math.PI) look2 -= Math.PI * 2;
    while (look2 < -Math.PI) look2 += Math.PI * 2;
    const gaze = Math.max(-0.9, Math.min(0.9, look2));
    const ballH = Math.hypot(sim.ball.x - player.x, sim.ball.z - player.z);
    p.headYaw += gaze * 0.75;
    p.chest += Math.min(0.12, gaze * gaze * 0.1);
    p.headPitch += ballH < 6 ? 0.12 : -0.03;

    // Arranque e frenagem deslocam a massa do tronco sem mover os pés do chão.
    // A raiz fica mais estável e a mudança de ritmo deixa de parecer deslizamento.
    p.spine += accelerationLean.current * 0.85;
    p.chest -= accelerationLean.current * 0.32;

    // ---- cansaço: respiração pesada, ombros caídos, tronco mais curvado
    const tired = 1 - Math.min(1, Math.max(0, player.stamina) / 100);
    if (tired > 0.25) {
      const br = Math.sin(state.clock.elapsedTime * 2.6 + seed) * tired * 0.05;
      p.spine += tired * 0.1 + br;
      p.chest += br * 0.6;
      p.armLRoll += tired * 0.06;
      p.armRRoll -= tired * 0.06;
      p.headPitch += tired * 0.07;
      // muito cansado e parado: curva o tronco e deixa os braços pesados
      if (tired > 0.6 && speed < 0.6 && !player.action) {
        const k = (tired - 0.6) / 0.4;
        p.spine += k * 0.22;
        p.headPitch += k * 0.1;
        p.armLPitch -= k * 0.35;
        p.armRPitch -= k * 0.35;
      }
    }

    target.current = p;
    mixPose(cur.current, target.current, Math.min(1, adt * 16), cur.current);
    const c = cur.current;

    // ---- balanço secundário dos braços (atrasa em relação ao tronco)
    const sway =
      Math.sin(state.clock.elapsedTime * 3.1 + seed) * 0.03 * (0.4 + Math.min(1, speed / 6));
    c.armLPitch += sway;
    c.armRPitch -= sway;

    // ---- aplica nas juntas
    if (hips.current) {
      // transferência de peso: o quadril desliza para o lado da perna de apoio
      const support = c.legRPitch - c.legLPitch; // >0 = apoio na esquerda
      const shift = Math.max(-1, Math.min(1, support)) * 0.045 * Math.min(1, speed / 4);
      hips.current.position.x += (shift - hips.current.position.x) * Math.min(1, adt * 14);
      hips.current.position.y = P.hipY + c.hipY;
      hips.current.rotation.set(c.hipPitch, c.hipYaw, c.hipRoll + shift * 1.2);
    }
    if (spine.current) spine.current.rotation.x = c.spine;
    if (chest.current) {
      chest.current.rotation.x = c.chest;
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
    // clavícula: acompanha parte do movimento do braço, como no corpo real
    if (clavLRef.current) {
      clavLRef.current.rotation.x = c.armLPitch * 0.16;
      clavLRef.current.rotation.z = -c.armLRoll * 0.12;
    }
    if (clavRRef.current) {
      clavRRef.current.rotation.x = c.armRPitch * 0.16;
      clavRRef.current.rotation.z = -c.armRRoll * 0.12;
    }
    if (armLRef.current) armLRef.current.rotation.set(c.armLPitch * 0.84, 0, c.armLRoll * 0.88);
    if (armRRef.current) armRRef.current.rotation.set(c.armRPitch * 0.84, 0, c.armRRoll * 0.88);
    if (foreLRef.current) foreLRef.current.rotation.x = c.elbowL;
    if (foreRRef.current) foreRRef.current.rotation.x = c.elbowR;
    // mandíbula: abre conforme o esforço, fechando quando o jogador descansa
    if (jawRef.current && lod === 0) {
      const effort = Math.min(1, speed / 7);
      jawRef.current.rotation.x =
        0.06 + effort * 0.16 + Math.sin(state.clock.elapsedTime * 4 + seed) * 0.03 * effort;
    }

    if (legLRef.current) legLRef.current.rotation.set(c.legLPitch, 0, c.legLRoll);
    if (legRRef.current) legRRef.current.rotation.set(c.legRPitch, 0, c.legRRoll);
    if (kneeLRef.current) kneeLRef.current.rotation.x = c.kneeL;
    if (kneeRRef.current) kneeRRef.current.rotation.x = c.kneeR;
    if (ankleLRef.current) ankleLRef.current.rotation.x = c.ankleL;
    if (ankleRRef.current) ankleRRef.current.rotation.x = c.ankleR;

    // ---- piscada ocasional (só perto da câmera, onde o rosto aparece)
    if (blinkRef.current && lod === 0) {
      nextBlink.current -= adt;
      const b = blinkRef.current;
      if (nextBlink.current <= 0) {
        b.scale.y = Math.min(1, b.scale.y + adt * 22);
        if (b.scale.y >= 1) nextBlink.current = 2 + ((seed % 7) + Math.random() * 3);
      } else {
        b.scale.y = Math.max(0.001, b.scale.y - adt * 16);
      }
    }

    // ---- sombra de contato acompanha a altura do quadril
    if (shadowRef.current) {
      const s = 1 - c.hipY * 0.5;
      shadowRef.current.scale.setScalar(s);
      // compensa a inclinação do corpo para a sombra ficar colada no gramado
      shadowRef.current.rotation.set(-Math.PI / 2 - g.rotation.x, 0, -g.rotation.z);
      const m = shadowRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.36 * s;
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
  const textureRevision = useKtx2Revision();
  useEffect(() => {
    if (quality !== "alta") return;
    const pattern = ["solid", "stripes", "pin", "hoops", "sash", "halves", "checks"].includes(kit.pattern) ? kit.pattern : "solid";
    const skinTone = ["#8d5524", "#6b4226"].includes(look.skin) ? "dark" :
      ["#e0ac69", "#f1c27d"].includes(look.skin) ? "light" : "medium";
    const boot = look.bootColor.toLowerCase() === "#101418" ? "leather" : "synthetic";
    requestKtx2([
      `jersey_${pattern}_normal`, `jersey_${pattern}_rough`,
      "shorts_plain_normal", "socks_rib_normal",
      `skin_${skinTone}_normal`, `boot_${boot}_normal`,
    ] as DetailKtx2Name[]);
  }, [quality, kit.pattern, look.skin, look.bootColor]);
  const mats = useMemo(
    () => playerMaterials(look, kit, tex ?? null, quality),
    [look, kit, tex, quality, textureRevision],
  );

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
    [P, look, segs.radial, segs.cap, hi, mats, jerseyInk],
  );
  useEffect(() => () => skin.dispose(), [skin]);

  // As malhas são criadas fora do JSX para carregar esqueleto, esfera de
  // culling generosa (a pose animada sai da pose de bind) e o estado de LOD.
  const drawMeshes = useMemo(() => {
    nearMeshes.current = [];
    bootMeshes.current = [];
    return skin.groups.map((group, index) => {
      const mesh = new THREE.SkinnedMesh(group.geometry, group.material);
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
      return createElement("primitive", { key: `${group.material.uuid}-${index}`, object: mesh });
    });
  }, [skin, shadows]);

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
    blink: blinkRef,
    clavL: clavLRef,
    armL: armLRef,
    foreL: foreLRef,
    clavR: clavRRef,
    armR: armRRef,
    foreR: foreRRef,
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
  useEffect(() => {
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
