// ============================================================================
//  PlayerRig.tsx
//  Malha 3D articulada dos jogadores.
//
//  A anatomia vem de `@/game/player-model` (determinística por id) e a pose
//  vem do catálogo procedural de `@/game/animation`. Cada articulação é um
//  <group> com pivô no lugar certo: quadril, lombar, peito, pescoço, ombro,
//  cotovelo, punho, joelho e tornozelo. Nada gira mais pelo centro da peça.
//
//  Custo: três níveis de LOD trocados por distância de câmera, avaliação de
//  animação em taxa reduzida longe da câmera e materiais simplificados fora
//  do modo "alta".
// ============================================================================

import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type React from "react";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { DISPLAY_FONT } from "@/components/game/fonts";

import {
  emptyPose,
  getClip,
  mixPose,
  selectClip,
  type ClipName,
  type Pose,
} from "@/game/animation";
import { kitTexture, type Kit } from "@/game/kits";
import { useVisual } from "@/game/visual-settings";
import {
  lodForDistance,
  lookFor,
  proportionsFor,
  segmentsFor,
  shade,
  skinShadow,
  type LodLevel,
} from "@/game/player-model";
import { type SimView, type SimPlayer } from "@/game/sim";

/** duração da transição cruzada entre dois movimentos, em segundos */
const BLEND_TIME = 0.18;
const ease = (u: number) => u * u * (3 - 2 * u);

export type Quality = "alta" | "media" | "baixa";

/* -------------------------------------------------------------------------- */

interface RigProps {
  player: SimPlayer;
  sim: SimView;
  kit: Kit;
  goalPulse: React.MutableRefObject<number>;
  quality: Quality;
}

export function PlayerRig({ player, sim, kit, goalPulse, quality: baseQuality }: RigProps) {
  // O usuário pode forçar mais ou menos detalhe na página /visual.
  const detail = useVisual().playerDetail;
  const quality: Quality =
    detail === "detalhado"
      ? "alta"
      : detail === "simples"
        ? "baixa"
        : baseQuality;

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

  // sobrenome grande nas costas + cor de tinta que contrasta com a camisa
  const surname = useMemo(() => {
    const parts = player.name.trim().split(/\s+/);
    return (parts[parts.length - 1] ?? player.name).toUpperCase().slice(0, 12);
  }, [player.name]);
  const [jerseyInk, jerseyInkOutline] = useMemo(() => {
    const h = kit.base.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return l > 0.55
      ? (["#101418", "#f2f2f2"] as const)
      : (["#f5f5f2", "#101418"] as const);
  }, [kit.base]);

  const isGK = player.pos === "GK";
  const hi = quality === "alta";
  const shadows = quality === "alta";

  /* -------------------------------------------------------------- juntas */

  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const foreLRef = useRef<THREE.Group>(null);
  const foreRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const kneeLRef = useRef<THREE.Group>(null);
  const kneeRRef = useRef<THREE.Group>(null);
  const ankleLRef = useRef<THREE.Group>(null);
  const ankleRRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);

  // grupos de LOD: detalhes finos (rosto, dedos, costuras) e corpo médio
  const lod0 = useRef<THREE.Group>(null);
  const lod1 = useRef<THREE.Group>(null);
  const spareRef = useRef<THREE.Group>(null);
  const lodState = useRef<LodLevel>(1);

  /* ---------------------------------------------------------- animação */

  const cur = useRef<Pose>(emptyPose());
  const target = useRef<Pose>(emptyPose());
  const blendBuf = useRef<Pose>(emptyPose());
  const clipName = useRef<ClipName>("idle");
  const prevName = useRef<ClipName | null>(null);
  const clipTime = useRef(0);
  const prevTime = useRef(0);
  const blend = useRef(1);
  const acc = useRef(0);
  const seed = look.seed % 97;


  useFrame((state, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);

    // ---- posição suavizada no gramado
    g.position.x += (player.x - g.position.x) * 0.34;
    g.position.z += (player.z - g.position.z) * 0.34;

    // ---- LOD por distância
    const camDist = state.camera.position.distanceTo(g.position);
    const lod = lodForDistance(camDist, quality);
    if (lod !== lodState.current) {
      lodState.current = lod;
      if (lod0.current) lod0.current.visible = lod === 0;
      if (lod1.current) lod1.current.visible = lod <= 1;
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
    const turnRate = d * (dirLen > 0.5 ? 0.2 : 0.08);
    g.rotation.y += turnRate;

    // ---- inclinação do corpo: para a frente na aceleração, para dentro na curva
    const leanF = Math.min(0.26, dirLen * 0.032);
    const leanS = Math.max(-0.3, Math.min(0.3, -turnRate * 6 * Math.min(1, dirLen / 5)));
    g.rotation.x += (leanF - g.rotation.x) * Math.min(1, dt * 6);
    g.rotation.z += (leanS - g.rotation.z) * Math.min(1, dt * 6);




    // ---- passo de animação em taxa reduzida longe da câmera
    const step = lod === 0 ? 0 : lod === 1 ? 1 / 40 : 1 / 20;
    acc.current += dt;
    if (acc.current < step) return;
    const adt = acc.current;
    acc.current = 0;

    const speed = dirLen;
    const stopped = goalPulse.current > 0.05 && player.action === null ? false : false;

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
      // guarda o clipe anterior para fazer a transição cruzada
      prevName.current = clipName.current;
      prevTime.current = clipTime.current;
      clipName.current = next;
      clipTime.current = 0;
      blend.current = 0;
    }
    clipTime.current += adt;
    prevTime.current += adt;
    blend.current = Math.min(1, blend.current + adt / BLEND_TIME);

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

    // ---- cansaço: respiração pesada, ombros caídos, tronco mais curvado
    const tired = 1 - Math.min(1, Math.max(0, player.stamina) / 100);
    if (tired > 0.25) {
      const br = Math.sin(state.clock.elapsedTime * 2.6 + seed) * tired * 0.05;
      p.spine += tired * 0.1 + br;
      p.chest += br * 0.6;
      p.armLRoll += tired * 0.06;
      p.armRRoll -= tired * 0.06;
      p.headPitch += tired * 0.07;
    }

    target.current = p;
    mixPose(cur.current, target.current, Math.min(1, adt * 16), cur.current);
    const c = cur.current;

    // ---- balanço secundário dos braços (atrasa em relação ao tronco)
    const sway = Math.sin(state.clock.elapsedTime * 3.1 + seed) * 0.03 * (0.4 + Math.min(1, speed / 6));
    c.armLPitch += sway;
    c.armRPitch -= sway;

    // ---- aplica nas juntas
    if (hips.current) {
      hips.current.position.y = P.hipY + c.hipY;
      hips.current.rotation.set(c.hipPitch, c.hipYaw, c.hipRoll);
    }
    if (spine.current) spine.current.rotation.x = c.spine;
    if (chest.current) chest.current.rotation.x = c.chest;
    if (neck.current) {
      neck.current.rotation.x = c.headPitch;
      neck.current.rotation.y = c.headYaw;
    }
    if (armLRef.current) armLRef.current.rotation.set(c.armLPitch, 0, c.armLRoll);
    if (armRRef.current) armRRef.current.rotation.set(c.armRPitch, 0, c.armRRoll);
    if (foreLRef.current) foreLRef.current.rotation.x = c.elbowL;
    if (foreRRef.current) foreRRef.current.rotation.x = c.elbowR;
    if (legLRef.current) legLRef.current.rotation.set(c.legLPitch, 0, c.legLRoll);
    if (legRRef.current) legRRef.current.rotation.set(c.legRPitch, 0, c.legRRoll);
    if (kneeLRef.current) kneeLRef.current.rotation.x = c.kneeL;
    if (kneeRRef.current) kneeRRef.current.rotation.x = c.kneeR;
    if (ankleLRef.current) ankleLRef.current.rotation.x = c.ankleL;
    if (ankleRRef.current) ankleRRef.current.rotation.x = c.ankleR;


    // ---- sombra de contato acompanha a altura do quadril
    if (shadowRef.current) {
      const s = 1 - c.hipY * 0.5;
      shadowRef.current.scale.setScalar(s);
      // compensa a inclinação do corpo para a sombra ficar colada no gramado
      shadowRef.current.rotation.set(-Math.PI / 2 - g.rotation.x, 0, -g.rotation.z);
      const m = shadowRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.3 * s;
    }
  });

  /* ------------------------------------------------------------ materiais */

  const segs = segmentsFor(0);

  const skinMat = hi ? (
    <meshPhysicalMaterial
      color={look.skin}
      roughness={0.6 - look.sweat * 0.16}
      clearcoat={0.28 + look.sweat * 0.25}
      envMapIntensity={0.8}
      clearcoatRoughness={0.5}
      sheen={0.2}
      sheenColor="#ffd9c0"
    />
  ) : (
    <meshStandardMaterial color={look.skin} roughness={0.7} />
  );

  const skinDark = <meshStandardMaterial color={skinShadow(look.skin)} roughness={0.72} />;

  const jerseyMat = hi ? (
    <meshPhysicalMaterial
      color={kit.base}
      map={tex ?? null}
      roughness={0.76}
      envMapIntensity={0.7}
      sheen={0.5}
      sheenColor={shade(kit.base, 0.4)}
    />
  ) : (
    <meshStandardMaterial color={kit.base} map={tex ?? null} roughness={0.85} />
  );

  const shortsMat = hi ? (
    <meshPhysicalMaterial
      color={kit.shorts}
      roughness={0.84}
      sheen={0.4}
      sheenColor={shade(kit.shorts, 0.35)}
    />
  ) : (
    <meshStandardMaterial color={kit.shorts} roughness={0.86} />
  );
  const socksMat = hi ? (
    <meshPhysicalMaterial
      color={kit.socks}
      roughness={0.92}
      sheen={0.6}
      sheenRoughness={0.8}
      sheenColor={shade(kit.socks, 0.45)}
    />
  ) : (
    <meshStandardMaterial color={kit.socks} roughness={0.9} />
  );
  const trimMat = <meshStandardMaterial color={kit.detail} roughness={0.8} />;
  const hairMat = (
    <meshStandardMaterial color={look.hairColor} roughness={0.85} metalness={0.02} />
  );
  const bootMat = hi ? (
    <meshPhysicalMaterial
      color={look.bootColor}
      roughness={0.22}
      metalness={0.1}
      clearcoat={0.85}
      clearcoatRoughness={0.18}
    />
  ) : (
    <meshStandardMaterial color={look.bootColor} roughness={0.34} metalness={0.22} />
  );
  const bootAccentMat = <meshStandardMaterial color={look.bootAccent} roughness={0.4} />;
  const soleMat = (
    <meshStandardMaterial color={shade(look.bootColor, -0.55)} roughness={0.6} />
  );
  const gloveMat = <meshStandardMaterial color={look.gloveColor} roughness={0.7} />;

  const handMat = look.gloves ? gloveMat : skinMat;
  const handR = look.gloves ? P.handR * 1.25 : P.handR;

  /* -------------------------------------------------------------- braço */

  function Arm({
    side,
    armRef,
    foreRef,
  }: {
    side: 1 | -1;
    armRef: React.RefObject<THREE.Group | null>;
    foreRef: React.RefObject<THREE.Group | null>;
  }) {
    return (
      <group
        ref={armRef}
        position={[side * P.shoulderW * 0.52, P.chestLen * 0.84, 0]}
      >
        {/* ombro */}
        <mesh position={[0, 0, 0]} castShadow={shadows}>
          <sphereGeometry args={[P.armR * 1.35, segs.radial, segs.radial]} />
          {jerseyMat}
        </mesh>
        {/* braço */}
        <mesh position={[0, -P.upperArm * 0.5, 0]} castShadow={shadows}>
          <capsuleGeometry args={[P.armR, P.upperArm * 0.78, segs.cap, segs.radial]} />
          {look.sleeves === "long" ? jerseyMat : skinMat}
        </mesh>
        {/* manga */}
        {look.sleeves === "short" && (
          <mesh position={[0, -P.upperArm * 0.24, 0]} castShadow={shadows}>
            <capsuleGeometry args={[P.armR * 1.22, P.upperArm * 0.3, 2, segs.radial]} />
            {jerseyMat}
          </mesh>
        )}
        {/* braçadeira de capitão */}
        {look.captain && side === 1 && (
          <mesh position={[0, -P.upperArm * 0.42, 0]}>
            <cylinderGeometry args={[P.armR * 1.28, P.armR * 1.28, 0.05, segs.radial]} />
            <meshStandardMaterial color="#ffd54a" roughness={0.6} />
          </mesh>
        )}
        {/* cotovelo → antebraço */}
        <group ref={foreRef} position={[0, -P.upperArm, 0]}>
          <mesh position={[0, -P.foreArm * 0.5, 0]} castShadow={shadows}>
            <capsuleGeometry args={[P.armR * 0.88, P.foreArm * 0.76, segs.cap, segs.radial]} />
            {look.sleeves === "long" ? jerseyMat : skinMat}
          </mesh>
          {/* punho / mão */}
          <group position={[0, -P.foreArm, 0]}>
            <mesh castShadow={shadows}>
              <sphereGeometry args={[handR, segs.radial, segs.radial]} />
              {handMat}
            </mesh>
            <group ref={side === 1 ? lod0 : spareRef}>
              {/* dedos, só no LOD mais próximo */}
              {[0, 1, 2, 3].map((i) => (
                <mesh
                  key={i}
                  position={[(i - 1.5) * handR * 0.45, -handR * 0.85, 0]}
                  rotation={[0.15, 0, 0]}
                >
                  <capsuleGeometry args={[handR * 0.2, handR * 0.7, 2, 5]} />
                  {handMat}
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
    );
  }

  /* --------------------------------------------------------------- perna */

  function Leg({
    side,
    legRef,
    kneeRef,
    ankleRef,
  }: {
    side: 1 | -1;
    legRef: React.RefObject<THREE.Group | null>;
    kneeRef: React.RefObject<THREE.Group | null>;
    ankleRef: React.RefObject<THREE.Group | null>;
  }) {
    return (
      <group ref={legRef} position={[side * P.hipW * 0.46, -P.hipH * 0.4, 0]}>
        {/* coxa */}
        <mesh position={[0, -P.thigh * 0.5, 0]} castShadow={shadows}>
          <capsuleGeometry args={[P.legR, P.thigh * 0.72, segs.cap, segs.radial]} />
          {skinMat}
        </mesh>
        {/* quadríceps */}
        <mesh
          position={[0, -P.thigh * 0.62, P.legR * 0.24]}
          scale={[0.9, 1, 0.7]}
          castShadow={shadows}
        >
          <capsuleGeometry args={[P.legR * 0.72, P.thigh * 0.3, segs.cap, segs.radial]} />
          {skinMat}
        </mesh>
        {/* barra do calção */}
        <mesh position={[0, -P.thigh * 0.32, 0]} castShadow={shadows}>
          <capsuleGeometry args={[P.legR * 1.3, P.thigh * 0.24, 2, segs.radial]} />
          {shortsMat}
        </mesh>
        <mesh position={[0, -P.thigh * 0.44, 0]}>
          <cylinderGeometry args={[P.legR * 1.31, P.legR * 1.28, 0.02, segs.radial]} />
          {trimMat}
        </mesh>
        {/* joelho */}
        <group ref={kneeRef} position={[0, -P.thigh, 0]}>
          <mesh>
            <sphereGeometry args={[P.legR * 0.94, segs.radial, segs.radial]} />
            {skinMat}
          </mesh>
          {/* panturrilha */}
          <mesh position={[0, -P.shin * 0.5, 0]} castShadow={shadows}>
            <capsuleGeometry args={[P.legR * 0.86, P.shin * 0.66, segs.cap, segs.radial]} />
            {skinMat}
          </mesh>
          <mesh
            position={[0, -P.shin * 0.34, -P.legR * 0.22]}
            scale={[0.85, 1, 0.75]}
            castShadow={shadows}
          >
            <capsuleGeometry args={[P.legR * 0.68, P.shin * 0.26, segs.cap, segs.radial]} />
            {skinMat}
          </mesh>
          {/* meião */}
          <mesh position={[0, -P.shin * 0.62, 0]} castShadow={shadows}>
            <capsuleGeometry args={[P.legR * 0.94, P.shin * 0.44, segs.cap, segs.radial]} />
            {socksMat}
          </mesh>
          {/* caneleira por baixo do meião */}
          <mesh
            position={[0, -P.shin * 0.55, P.legR * 0.5]}
            scale={[0.8, 1, 0.35]}
            castShadow={shadows}
          >
            <capsuleGeometry args={[P.legR * 0.7, P.shin * 0.3, 2, segs.radial]} />
            {socksMat}
          </mesh>
          {/* punho do meião */}
          <mesh position={[0, -P.shin * 0.36, 0]}>
            <cylinderGeometry args={[P.legR * 1.02, P.legR * 0.98, 0.045, segs.radial]} />
            {trimMat}
          </mesh>
          {look.sockTape && (
            <mesh position={[0, -P.shin * 0.46, 0]}>
              <cylinderGeometry args={[P.legR * 1.03, P.legR * 1.03, 0.035, segs.radial]} />
              {trimMat}
            </mesh>
          )}
          {/* tornozelo → chuteira */}
          <group ref={ankleRef} position={[0, -P.shin, 0]}>
            {/* cano do meião sobre o tornozelo */}
            <mesh position={[0, P.footH * 0.12, 0]}>
              <capsuleGeometry args={[P.legR * 0.72, P.footH * 0.2, 2, segs.radial]} />
              {socksMat}
            </mesh>
            {/* cabedal */}
            <mesh position={[0, -P.footH * 0.32, P.footLen * 0.16]} castShadow={shadows}>
              <capsuleGeometry args={[P.footH * 0.5, P.footLen * 0.45, 3, segs.radial]} />
              {bootMat}
            </mesh>
            {/* bico */}
            <mesh
              position={[0, -P.footH * 0.45, P.footLen * 0.42]}
              scale={[0.85, 0.7, 1]}
              castShadow={shadows}
            >
              <sphereGeometry args={[P.footH * 0.46, segs.radial, segs.radial]} />
              {bootMat}
            </mesh>
            {/* calcanhar */}
            <mesh position={[0, -P.footH * 0.24, -P.footLen * 0.16]} scale={[0.85, 1, 0.7]}>
              <sphereGeometry args={[P.footH * 0.44, segs.radial, segs.radial]} />
              {bootMat}
            </mesh>
            {/* faixa lateral / listra da marca */}
            <mesh position={[0, -P.footH * 0.34, P.footLen * 0.18]} rotation={[0, 0, 0.1]}>
              <boxGeometry args={[P.footH * 1.04, P.footH * 0.12, P.footLen * 0.4]} />
              {bootAccentMat}
            </mesh>
            {/* sola */}
            <mesh position={[0, -P.footH * 0.62, P.footLen * 0.1]}>
              <boxGeometry args={[P.footH * 1.0, P.footH * 0.16, P.footLen * 0.86]} />
              {soleMat}
            </mesh>
            <group ref={side === 1 ? lod1 : spareRef}>
              {/* cadarços */}
              {[0, 1, 2].map((i) => (
                <mesh
                  key={`l${i}`}
                  position={[0, -P.footH * 0.12, P.footLen * (0.1 + i * 0.09)]}
                  rotation={[0.12, 0, 0]}
                >
                  <boxGeometry args={[P.footH * 0.5, P.footH * 0.06, P.footLen * 0.04]} />
                  {bootAccentMat}
                </mesh>
              ))}
              {/* travas */}
              {([
                [-0.3, 0.36],
                [0.3, 0.36],
                [-0.32, 0.02],
                [0.32, 0.02],
                [0, -0.28],
              ] as const).map(([sx, sz], i) => (
                <mesh
                  key={i}
                  position={[sx * P.footH, -P.footH * 0.78, sz * P.footLen]}
                  rotation={[Math.PI, 0, 0]}
                >
                  <coneGeometry args={[0.011, 0.022, 5]} />
                  <meshStandardMaterial color="#e6e6e6" roughness={0.45} metalness={0.3} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
    );
  }

  /* ---------------------------------------------------------------- rosto */

  const face = (
    <group>
      {/* olhos */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * P.headR * 0.36, P.headR * 0.1, P.headR * 0.82]}>
            <sphereGeometry args={[P.headR * 0.15, 8, 8]} />
            <meshStandardMaterial color="#f7f7f7" roughness={0.35} />
          </mesh>
          <mesh position={[s * P.headR * 0.36, P.headR * 0.1, P.headR * 0.93]}>
            <sphereGeometry args={[P.headR * 0.07, 8, 8]} />
            <meshStandardMaterial color="#181818" roughness={0.3} />
          </mesh>
          {/* sobrancelha */}
          <mesh position={[s * P.headR * 0.36, P.headR * 0.32, P.headR * 0.84]}>
            <boxGeometry args={[P.headR * 0.36, P.headR * 0.08, P.headR * 0.1]} />
            {hairMat}
          </mesh>
          {/* orelha */}
          <mesh position={[s * P.headR * 0.94, 0, -P.headR * 0.05]} scale={[0.4, 1, 0.7]}>
            <sphereGeometry args={[P.headR * 0.3, 8, 8]} />
            {skinMat}
          </mesh>
        </group>
      ))}
      {/* nariz */}
      <mesh position={[0, -P.headR * 0.05, P.headR * 0.95]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[P.headR * 0.16, P.headR * 0.34, 6]} />
        {skinMat}
      </mesh>
      {/* boca */}
      <mesh position={[0, -P.headR * 0.45, P.headR * 0.84]}>
        <boxGeometry args={[P.headR * 0.34, P.headR * 0.07, P.headR * 0.06]} />
        <meshStandardMaterial color={shade(look.skin, -0.45)} roughness={0.6} />
      </mesh>
    </group>
  );

  /* ---------------------------------------------------------------- barba */

  const beard = (() => {
    if (look.beard === "none") return null;
    if (look.beard === "moustache")
      return (
        <mesh position={[0, -P.headR * 0.3, P.headR * 0.86]}>
          <boxGeometry args={[P.headR * 0.44, P.headR * 0.1, P.headR * 0.12]} />
          {hairMat}
        </mesh>
      );
    if (look.beard === "goatee")
      return (
        <mesh position={[0, -P.headR * 0.62, P.headR * 0.66]} scale={[0.7, 1, 0.7]}>
          <sphereGeometry args={[P.headR * 0.3, 8, 8]} />
          {hairMat}
        </mesh>
      );
    // stubble / full
    return (
      <mesh
        position={[0, -P.headR * 0.35, P.headR * 0.12]}
        scale={[1.01, look.beard === "full" ? 0.85 : 0.6, 1.01]}
      >
        <sphereGeometry args={[P.headR * 0.98, 12, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.4]} />
        {hairMat}
      </mesh>
    );
  })();

  /* --------------------------------------------------------------- cabelo */

  const hair = (() => {
    const s = look.hairStyle;
    if (s === "bald") return null;
    const capHeight = s === "buzz" ? 0.96 : s === "short" ? 1.02 : 1.06;
    const base = (
      <mesh position={[0, P.headR * 0.16, -P.headR * 0.04]} scale={[1.02, capHeight, 1.04]}>
        <sphereGeometry args={[P.headR * 0.99, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        {hairMat}
      </mesh>
    );
    return (
      <group>
        {base}
        {s === "mohawk" && (
          <mesh position={[0, P.headR * 0.95, 0]} scale={[0.24, 1, 1.05]}>
            <sphereGeometry args={[P.headR * 0.62, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
            {hairMat}
          </mesh>
        )}
        {(s === "afro" || s === "curly") && (
          <mesh position={[0, P.headR * 0.42, -P.headR * 0.02]}>
            <sphereGeometry args={[P.headR * (s === "afro" ? 1.24 : 1.1), 12, 12]} />
            {hairMat}
          </mesh>
        )}
        {s === "bun" && (
          <mesh position={[0, P.headR * 0.62, -P.headR * 0.95]}>
            <sphereGeometry args={[P.headR * 0.34, 10, 10]} />
            {hairMat}
          </mesh>
        )}
        {s === "ponytail" && (
          <mesh position={[0, P.headR * 0.2, -P.headR * 1.05]} rotation={[0.6, 0, 0]}>
            <capsuleGeometry args={[P.headR * 0.16, P.headR * 0.8, 3, 8]} />
            {hairMat}
          </mesh>
        )}
        {(s === "dreads" || s === "braids") &&
          Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[
                  Math.cos(a) * P.headR * 0.7,
                  P.headR * 0.1,
                  Math.sin(a) * P.headR * 0.7,
                ]}
                rotation={[0.25, 0, 0]}
              >
                <capsuleGeometry args={[P.headR * 0.09, P.headR * 0.9, 2, 6]} />
                {hairMat}
              </mesh>
            );
          })}
        {look.headband && (
          <mesh position={[0, P.headR * 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[P.headR * 0.94, P.headR * 0.11, 6, 16]} />
            <meshStandardMaterial color={look.headbandColor} roughness={0.8} />
          </mesh>
        )}
      </group>
    );
  })();

  /* ------------------------------------------------------------- render */

  return (
    <group ref={root} position={[player.x, 0, player.z]}>
      {/* sombra de contato */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.36, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* quadril = raiz do esqueleto */}
      <group ref={hips} position={[0, P.hipY, 0]}>
        <mesh castShadow={shadows}>
          <capsuleGeometry args={[P.hipW * 0.62, P.hipH * 0.6, segs.cap, segs.radial]} />
          {shortsMat}
        </mesh>
        {/* cós */}
        <mesh position={[0, P.hipH * 0.5, 0]}>
          <cylinderGeometry args={[P.hipW * 0.66, P.hipW * 0.64, 0.045, segs.radial]} />
          {trimMat}
        </mesh>

        {/* lombar */}
        <group ref={spine} position={[0, P.hipH * 0.5, 0]}>
          <mesh position={[0, P.spineLen * 0.5, 0]} scale={[1, 1, 0.82]} castShadow={shadows}>
            <capsuleGeometry args={[P.chestW * 0.5, P.spineLen * 0.7, segs.cap, segs.radial]} />
            {jerseyMat}
          </mesh>

          {/* peito */}
          <group ref={chest} position={[0, P.spineLen, 0]}>
            <mesh
              position={[0, P.chestLen * 0.46, 0]}
              scale={[1, 1, P.chestD / (P.chestW * 0.58)]}
              castShadow={shadows}
            >
              <capsuleGeometry args={[P.chestW * 0.58, P.chestLen * 0.62, segs.cap, segs.radial]} />
              {jerseyMat}
            </mesh>
            {/* linha dos ombros */}
            <mesh position={[0, P.chestLen * 0.84, 0]} rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[P.armR * 1.3, P.shoulderW * 0.8, 3, segs.radial]} />
              {jerseyMat}
            </mesh>
            {/* gola */}
            <mesh position={[0, P.chestLen * 0.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[P.neckR * 1.5, P.neckR * 0.28, 6, 14]} />
              {trimMat}
            </mesh>

            {/* nome + número 3D nítidos nas costas (só na qualidade alta) */}
            {hi ? (
              <Suspense fallback={null}>
                <Text
                  font={DISPLAY_FONT}
                  position={[0, P.chestLen * 0.74, -(P.chestD + 0.02)]}
                  rotation={[0, Math.PI, 0]}
                  fontSize={0.1}
                  letterSpacing={0.06}
                  color={jerseyInk}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.008}
                  outlineColor={jerseyInkOutline}
                >
                  {surname}
                </Text>
                <Text
                  font={DISPLAY_FONT}
                  position={[0, P.chestLen * 0.36, -(P.chestD + 0.02)]}
                  rotation={[0, Math.PI, 0]}
                  fontSize={0.24}
                  color={jerseyInk}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.01}
                  outlineColor={jerseyInkOutline}
                >
                  {String(player.number)}
                </Text>
              </Suspense>
            ) : null}

            {/* pescoço + cabeça */}
            <group ref={neck} position={[0, P.chestLen * 1.0, 0]}>
              <mesh position={[0, P.neckLen * 0.5, 0]} castShadow={shadows}>
                <capsuleGeometry args={[P.neckR, P.neckLen * 0.8, 3, segs.radial]} />
                {look.undershirt ? (
                  <meshStandardMaterial color={look.undershirtColor} roughness={0.85} />
                ) : (
                  skinDark
                )}
              </mesh>
              <group position={[0, P.neckLen + P.headR * 0.82, 0]}>
                {/* crânio */}
                <mesh scale={[1, 1.14, 1.02]} castShadow={shadows}>
                  <sphereGeometry args={[P.headR, 16, 16]} />
                  {skinMat}
                </mesh>
                {/* mandíbula */}
                <mesh position={[0, -P.headR * 0.5, P.headR * 0.12]} scale={[0.82, 0.6, 0.9]}>
                  <sphereGeometry args={[P.headR, 12, 12]} />
                  {skinMat}
                </mesh>
                <group ref={lod0}>{face}</group>
                {beard}
                {hair}
              </group>
            </group>

            <Arm side={1} armRef={armLRef} foreRef={foreLRef} />
            <Arm side={-1} armRef={armRRef} foreRef={foreRRef} />
          </group>
        </group>

        <Leg side={1} legRef={legLRef} kneeRef={kneeLRef} ankleRef={ankleLRef} />
        <Leg side={-1} legRef={legRRef} kneeRef={kneeRRef} ankleRef={ankleRRef} />
      </group>
    </group>
  );
}

export default PlayerRig;
