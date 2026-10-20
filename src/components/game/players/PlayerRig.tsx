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

import { useThree } from "@react-three/fiber";
import type React from "react";
import { createElement, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { kitBudget, kitTextureFor, trimKitTextures } from "@/game/graphics/kit-atlas";
import { retainKitTexture } from "@/game/kits";
import { useMatchSurface } from "@/game/graphics/surface-context";
import { onKtx2Ready } from "@/game/textures/ktx2";
import { useVisual } from "@/game/visual-settings";
import {
  lodForDistance,
  lookFor,
  lookWithPhysique,
  proportionsFor,
  shade,
  type LodLevel,
} from "@/game/player-model";
import { type RigJoint } from "@/game/rig-skin";
import { faceMorphology } from "@/game/player-morphology";
import { censusRef } from "@/game/scene-census";
import { retainRigGeometryPreparation } from "@/game/rig-geometry-worker-client";

import { type RigProps, type Quality } from "./player-rig-contract";
import { usePlayerRigFrame, type PlayerRigBoneRefs } from "./player-rig-frame";
import { usePlayerRigMeshes } from "./player-rig-meshes";
import { softShadowTexture } from "./soft-shadow";
export type { Quality } from "./player-rig-contract";

export const PlayerRig = memo(function PlayerRig({
  player,
  sim,
  kit,
  goalPulse,
  goalFocus,
  lookOverride,
  portrait = false,
  denseGeometry = true,
  matchTopology = false,
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
    () =>
      kitTextureFor(kit, player.number, player.name, {
        lod: portrait || denseGeometry ? 0 : 1,
        quality,
      }),
    [kit, player.number, player.name, quality, portrait, denseGeometry],
  );
  useEffect(() => {
    const release = retainKitTexture(tex);
    // Reclaim LRU atlases from earlier matches without ever disposing a
    // texture owned by a currently mounted athlete.
    trimKitTextures(kitBudget(quality).limitBytes);
    return release;
  }, [quality, tex]);
  // A disabled or unmeasured Rust geometry path remains inert. Once its
  // full-flow gate is approved this mounts one bounded preparation owner for
  // the visible rig, with cleanup on every Studio/match exit.
  useEffect(() => retainRigGeometryPreparation(), []);

  // Cor de identificação que contrasta com a camisa.
  const jerseyInk = useMemo(() => {
    const h = kit.base.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l > 0.55 ? "#101418" : "#f5f5f2";
  }, [kit.base]);

  const hi = quality === "alta";
  // The match keeps its small contact ellipse under each athlete. Full body
  // shadow-map silhouettes stay in the isolated portrait studio; in broadcast
  // views they read as broad cool blotches across the pitch.
  const shadows = quality === "alta" && portrait;
  const contactShadow = useMemo(softShadowTexture, []);
  const invalidate = useThree((state) => state.invalidate);
  // Demand-rendered studio previews still display newly loaded maps while
  // paused. Match playback needs no React updates for texture streaming.
  useEffect(() => {
    if (paused) return onKtx2Ready(() => invalidate());
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
  const eyelidUpperLRef = useRef<THREE.Bone>(null);
  const eyelidLowerLRef = useRef<THREE.Bone>(null);
  const eyelidUpperRRef = useRef<THREE.Bone>(null);
  const eyelidLowerRRef = useRef<THREE.Bone>(null);
  const clavLRef = useRef<THREE.Bone>(null);
  const clavRRef = useRef<THREE.Bone>(null);
  const jawRef = useRef<THREE.Bone>(null);
  const eyesRef = useRef<THREE.Bone>(null);
  // LOD por grupo de desenho: os grupos "near" (rosto, dedos) somem a partir
  // do LOD 1 e os "boot" (travas) a partir do LOD 2 — a maioria dos 22
  // atletas fica longe da câmera na maior parte do tempo.
  const nearMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const bootMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const skinnedMeshes = useRef<THREE.SkinnedMesh[]>([]);
  const lodState = useRef<LodLevel | null>(null);
  const castState = useRef<boolean | null>(null);
  const painted = useRef(false);

  const { skin, cloth, drawMeshes } = usePlayerRigMeshes({
    quality,
    portrait,
    denseGeometry,
    matchTopology,
    look,
    kit,
    tex,
    surface,
    hi,
    P,
    jerseyInk,
    player,
    shadows,
    clothPhysics,
    painted,
    lodState,
    castState,
    nearMeshes,
    bootMeshes,
    skinnedMeshes,
  });

  // Junta -> osso. `createElement` (e não JSX) de propósito: o plugin de
  // desenvolvimento injeta atributos de origem no JSX e o R3F não aceita isso
  // num <primitive>.
  // Só as juntas que a animação escreve precisam de ref; as demais existem na
  // hierarquia para carregar a geometria dos grupos de LOD.
  const boneRefs = useMemo<PlayerRigBoneRefs>(
    () => ({
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
    }),
    [],
  );
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
  }, [skin, boneRefs]);
  usePlayerRigFrame({
    scene: {
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
      onPoseReady,
    },
    resources: {
      root,
      shadowRef,
      bones: boneRefs,
      painted,
      lodState,
      castState,
      nearMeshes,
      bootMeshes,
      skin,
      cloth,
    },
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
      <mesh
        ref={shadowRef}
        visible={!portrait}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
      >
        <circleGeometry args={[0.36, 16]} />
        <meshBasicMaterial
          map={contactShadow}
          color="#000000"
          transparent
          opacity={0.3}
          depthWrite={false}
        />
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
