// ============================================================================
//  CinematicStage3D.tsx
//  Cenários 3D reais das cenas cinematográficas: vestiário, túnel, entrada em
//  campo, coletiva, arquibancada e sala da diretoria.
//
//  Cada cena tem geometria própria, luz prática (lâmpadas, refletores, flashes),
//  névoa, figurantes articulados e um "diretor de câmera" que corta a cada fala
//  e faz um travelling contínuo dentro da fala.
// ============================================================================

import { Environment, Lightformer, Float } from "@react-three/drei";
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { SceneArt, Speaker } from "@/content/cutscenes";
import type { LineLight, ShotSize } from "@/game/cutscene-director";

/** true quando o locutor da fala atual é um dos donos deste figurante-herói */
function actsFor(speaker: Speaker | null, roles: Speaker[]): boolean {
  return speaker !== null && roles.includes(speaker);
}
import { PostFX } from "@/components/game/post/PostFX";
import { detectQuality, lowerQuality, type QualityLevel } from "@/game/device";

type SetKind = "locker" | "tunnel" | "press" | "pitch" | "stands" | "office" | "arrival";

const SET_BY_ART: Record<SceneArt, SetKind> = {
  arrival: "arrival",
  press: "press",
  dressing: "locker",
  trophy: "pitch",
  training: "pitch",
  gym: "locker",
  tactics: "locker",
  staff: "office",
  board: "office",
  transfer: "office",
  tunnel: "tunnel",
  kitroom: "locker",
  pitchentry: "pitch",
  celebration: "stands",
  defeat: "locker",
  farewell: "tunnel",
  bus: "arrival",
  office: "office",
  medical: "locker",
  gala: "press",
};

/**
 * Enquadramentos por cenário: a câmera corta para o próximo a cada fala.
 * Os dois últimos de cada lista são o contra-plano (o "outro lado" da cena,
 * para imprensa/torcida) e o close baixo (clímax: tensão e revelação).
 */
const SHOTS: Record<SetKind, Array<[number, number, number, number, number, number]>> = {
  //          posX   posY  posZ   alvoX alvoY alvoZ
  locker: [
    [0, 1.9, 5.6, 0, 1.2, -1.2],
    [-3.2, 1.35, 2.4, -0.6, 1.1, -2.4],
    [2.6, 2.4, 3.2, 0.4, 1.0, -2.0],
    [0.4, 1.05, 1.9, -0.4, 1.25, -2.8],
    [0, 1.5, -3.4, 0, 1.3, 4.5],
    [-0.9, 1.35, 0.4, -0.3, 1.2, -2.6],
  ],
  tunnel: [
    [0, 1.7, 7.4, 0, 1.6, -8],
    [1.5, 1.2, 3.2, -0.6, 1.5, -6],
    [-1.6, 2.5, 1.2, 0.2, 1.3, -7],
    [0, 1.45, -1.5, 0, 1.7, -9.5],
    [0, 1.9, -6.5, 0, 1.5, 5],
    [0.7, 1.1, 0.8, -0.3, 1.6, -8],
  ],
  press: [
    [0, 1.75, 5.4, 0, 1.25, -2.2],
    [-2.8, 1.3, 2.6, 0.1, 1.3, -2.6],
    [2.4, 2.1, 2.2, -0.2, 1.2, -2.8],
    [0.2, 1.1, 1.6, 0, 1.3, -3],
    [0, 1.6, -3.2, 0, 1.2, 4],
    [-0.7, 1.5, 0.3, 0.1, 1.25, -2.8],
  ],
  pitch: [
    [0, 2.4, 9.5, 0, 1.2, -1],
    [-6.5, 1.1, 4.5, 0, 1.3, -2],
    [5.5, 3.4, 5.5, -0.5, 1.0, -3],
    [0, 0.85, 3.2, 0, 1.5, -4],
    [0, 3.8, -8.5, 0, 1.4, 4],
    [-1.4, 1.0, 1.1, 0.4, 1.4, -3.5],
  ],
  stands: [
    [0, 3.2, 11, 0, 3.4, -6],
    [-7, 2.1, 6, 1, 3.2, -7],
    [6.5, 4.6, 7, -1, 3.0, -7],
    [0, 1.6, 4.5, 0, 3.8, -8],
    [0, 4.2, -9, 0, 3.2, 6],
    [2.1, 1.9, 2.6, -0.5, 3.6, -7.5],
  ],
  office: [
    [0, 1.8, 5.2, 0, 1.15, -1.6],
    [-2.7, 1.45, 2.8, 0.3, 1.1, -2.2],
    [2.5, 2.0, 2.6, -0.3, 1.1, -2.2],
    [0.3, 1.2, 1.9, 0, 1.2, -2.6],
    [0, 1.6, -2.8, 0, 1.15, 3.6],
    [-0.8, 1.4, 0.5, 0.2, 1.15, -2.4],
  ],
  arrival: [
    [0, 2.6, 10.5, 0, 1.6, -2],
    [-5.5, 1.4, 4.5, 0.5, 1.5, -3],
    [5.5, 2.2, 4.5, -0.5, 1.4, -3],
    [1.2, 1.0, 2.6, -0.4, 1.5, -4],
    [0, 2.2, -7.5, 0, 1.6, 5],
    [-1.6, 1.3, 0.6, 0.2, 1.5, -4.5],
  ],
};

/* ------------------------------------------------------------- figurantes */

const SKIN = ["#f0c39a", "#d9a173", "#b57a4c", "#8a5733", "#5f3a22"];
const HAIR = ["#1b1410", "#2f1d12", "#5b3a1c", "#9a6b35", "#151515"];

function hash(seed: number) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Figurante articulado: pescoço, tronco, braços e pernas com respiração. */
function Figure({
  x,
  z,
  rot = 0,
  color,
  shorts = "#12181c",
  seed = 1,
  pose = "stand",
  scale = 1,
  acting = false,
}: {
  x: number;
  z: number;
  rot?: number;
  color: string;
  shorts?: string;
  seed?: number;
  pose?: "stand" | "sit" | "walk";
  scale?: number;
  /** true quando este figurante é quem está falando: gesticula e balança a cabeça */
  acting?: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const skin = SKIN[Math.floor(hash(seed) * SKIN.length)]!;
  const hair = HAIR[Math.floor(hash(seed + 7) * HAIR.length)]!;
  const off = hash(seed + 3) * 6.28;

  const actingRef = useRef(acting);
  actingRef.current = acting;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + off;
    const talk = actingRef.current ? 1 : 0;
    if (chest.current)
      chest.current.scale.y = 1 + Math.sin(t * 1.6) * 0.016 + (talk ? Math.sin(t * 7) * 0.008 : 0);
    if (head.current) {
      // falando: acenos curtos e rítmicos; calado: vagueia devagar
      head.current.rotation.y =
        Math.sin(t * 0.5) * 0.2 * (1 - talk) + Math.sin(t * 2.4) * 0.08 * talk;
      head.current.rotation.x =
        Math.sin(t * 0.37) * 0.06 + (talk ? Math.abs(Math.sin(t * 3.6)) * 0.14 : 0);
    }
    const swing = pose === "walk" ? Math.sin(t * 3.2) * 0.5 : Math.sin(t * 0.9) * 0.07;
    if (armL.current) armL.current.rotation.x = swing * (1 - talk * 0.5);
    if (armR.current) {
      // falando: mão direita erguida marcando o ritmo da fala
      armR.current.rotation.x = talk
        ? -1.15 + Math.sin(t * 5.2) * 0.28
        : pose === "walk"
          ? -swing
          : -swing;
    }
    if (rig.current && pose === "walk")
      rig.current.position.y = Math.abs(Math.sin(t * 3.2)) * 0.035;
  });

  const sit = pose === "sit";
  const hipY = sit ? 0.52 : 0.92;

  return (
    <group ref={rig} position={[x, 0, z]} rotation-y={rot} scale={scale}>
      {/* pernas */}
      <group position={[0, hipY, 0]} rotation-x={sit ? -1.2 : 0}>
        <mesh position={[-0.11, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.078, 0.44, 4, 8]} />
          <meshStandardMaterial color={shorts} roughness={0.78} />
        </mesh>
        <mesh position={[0.11, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.078, 0.44, 4, 8]} />
          <meshStandardMaterial color={shorts} roughness={0.78} />
        </mesh>
      </group>
      <mesh position={[-0.11, sit ? 0.14 : 0.22, sit ? 0.4 : 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.36, 4, 8]} />
        <meshStandardMaterial color={skin} roughness={0.66} />
      </mesh>
      <mesh position={[0.11, sit ? 0.14 : 0.22, sit ? 0.4 : 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.36, 4, 8]} />
        <meshStandardMaterial color={skin} roughness={0.66} />
      </mesh>
      {/* tronco */}
      <group ref={chest} position={[0, hipY + 0.02, 0]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.44, 6, 14]} />
          <meshStandardMaterial color={color} roughness={0.56} />
        </mesh>
        {/* ombros e braços */}
        <group ref={armL} position={[-0.24, 0.48, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <capsuleGeometry args={[0.058, 0.44, 4, 8]} />
            <meshStandardMaterial color={skin} roughness={0.64} />
          </mesh>
        </group>
        <group ref={armR} position={[0.24, 0.48, 0]}>
          <mesh position={[0, -0.26, 0]} castShadow>
            <capsuleGeometry args={[0.058, 0.44, 4, 8]} />
            <meshStandardMaterial color={skin} roughness={0.64} />
          </mesh>
        </group>
        {/* pescoço + cabeça */}
        <group ref={head} position={[0, 0.66, 0]}>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.055, 0.065, 0.1, 8]} />
            <meshStandardMaterial color={skin} roughness={0.68} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.125, 18, 14]} />
            <meshStandardMaterial color={skin} roughness={0.62} />
          </mesh>
          <mesh position={[0, 0.15, -0.012]} scale={[1.03, 0.82, 1.03]}>
            <sphereGeometry args={[0.126, 16, 12]} />
            <meshStandardMaterial color={hair} roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------- efeitos de set */

/** Chuva de papel picado sobre a entrada em campo (taça, festa, acesso). */
function CelebrationRain() {
  const COUNT = 130;
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: -8 + ((i * 37) % 160) / 10,
        y: ((i * 53) % 90) / 10,
        z: -6 + ((i * 29) % 120) / 10,
        fall: 0.7 + ((i * 11) % 10) / 12,
        spin: 1 + (i % 4),
        ph: (i % 9) * 0.7,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const p = parts[i]!;
      p.y -= p.fall * dt;
      if (p.y < 0.05) p.y = 8 + Math.random() * 2;
      dummy.position.set(p.x + Math.sin(t * 1.4 + p.ph) * 0.5, p.y, p.z);
      dummy.rotation.set(t * p.spin + p.ph, p.ph, t * p.spin * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
      onUpdate={(m) => {
        for (let i = 0; i < COUNT; i++) {
          col.setHSL((i * 0.37) % 1, 0.85, 0.6);
          m.setColorAt(i, col);
        }
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
    >
      <planeGeometry args={[0.16, 0.1]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/** Disparos de flash dos fotógrafos na coletiva (rajadas aleatórias). */
function PressFlashes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const state = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ x: -3.4 + i * 1.7, next: i * 0.7, heat: 0 })),
    [],
  );
  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    for (let i = 0; i < state.length; i++) {
      const f = state[i]!;
      f.next -= dt;
      if (f.next <= 0) {
        f.next = 0.5 + Math.random() * 3.5;
        f.heat = 1;
      }
      f.heat = Math.max(0, f.heat - dt * 10);
      dummy.position.set(f.x, 1.55, 2.1);
      dummy.scale.setScalar(Math.max(0.0001, f.heat * 1.4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 5]} frustumCulled={false}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/** Poeira flutuando nos fachos do túnel. */
function TunnelDust() {
  const COUNT = 70;
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: -2.6 + ((i * 37) % 52) / 10,
        y: 0.3 + ((i * 23) % 30) / 10,
        z: -11 + ((i * 53) % 160) / 10,
        ph: (i % 12) * 0.5,
      })),
    [],
  );
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]!;
      pos.setXYZ(
        i,
        s.x + Math.sin(t * 0.5 + s.ph) * 0.25,
        s.y + Math.sin(t * 0.34 + s.ph * 2) * 0.2,
        s.z,
      );
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        color="#dff5e4"
        size={0.05}
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ sets */

function LockerRoom({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.intensity = 9 + Math.sin(clock.elapsedTime * 9.3) * 0.4;
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color="#2c3235" roughness={0.42} metalness={0.1} />
      </mesh>
      {/* paredes */}
      <mesh receiveShadow position={[0, 2.4, -4.4]}>
        <boxGeometry args={[18, 4.8, 0.2]} />
        <meshStandardMaterial color="#141d18" roughness={0.9} />
      </mesh>
      <mesh receiveShadow position={[-7, 2.4, 0]}>
        <boxGeometry args={[0.2, 4.8, 14]} />
        <meshStandardMaterial color="#111917" roughness={0.92} />
      </mesh>
      <mesh receiveShadow position={[7, 2.4, 0]}>
        <boxGeometry args={[0.2, 4.8, 14]} />
        <meshStandardMaterial color="#111917" roughness={0.92} />
      </mesh>
      {/* armários com camisas penduradas */}
      {Array.from({ length: 9 }).map((_, i) => (
        <group key={i} position={[-6.4 + i * 1.6, 0, -4]}>
          <mesh position={[0, 1.3, 0]} receiveShadow castShadow>
            <boxGeometry args={[1.42, 2.6, 0.62]} />
            <meshStandardMaterial color="#1c2a22" roughness={0.78} />
          </mesh>
          <mesh position={[0, 0.42, 0.34]} castShadow>
            <boxGeometry args={[1.42, 0.12, 0.62]} />
            <meshStandardMaterial color="#5a4128" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.7, 0.3]} castShadow>
            <boxGeometry args={[0.78, 1.06, 0.06]} />
            <meshStandardMaterial color={i % 2 ? secondary : primary} roughness={0.52} />
          </mesh>
          <mesh position={[0, 1.72, 0.34]}>
            <planeGeometry args={[0.3, 0.3]} />
            <meshStandardMaterial color={i % 2 ? primary : secondary} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* banco central e quadro tático */}
      <mesh position={[0, 0.44, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[6.4, 0.16, 0.72]} />
        <meshStandardMaterial color="#6b4d2c" roughness={0.8} />
      </mesh>
      <mesh position={[4.6, 1.8, -4.25]}>
        <boxGeometry args={[2.6, 1.6, 0.08]} />
        <meshStandardMaterial
          color="#0d1712"
          emissive="#0d3a22"
          emissiveIntensity={0.4}
          roughness={0.5}
        />
      </mesh>
      {/* lâmpadas práticas */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 3.5, -1]}>
          <boxGeometry args={[2.6, 0.08, 0.3]} />
          <meshBasicMaterial color="#e9fff1" toneMapped={false} />
        </mesh>
      ))}
      <pointLight
        ref={lamp}
        position={[0, 3.3, -1]}
        intensity={9}
        distance={14}
        color="#dcffe9"
        castShadow
      />
      <Figure x={-1.9} z={0.6} rot={0.2} pose="sit" color={primary} seed={2} />
      <Figure x={-0.4} z={0.6} rot={-0.1} pose="sit" color={primary} seed={5} />
      <Figure x={1.4} z={0.6} rot={0.12} pose="sit" color={secondary} seed={9} />
      <Figure x={2.9} z={0.6} rot={-0.25} pose="sit" color={primary} seed={13} />
      <Figure
        x={0.2}
        z={-2.1}
        rot={3.1}
        color="#1d2b24"
        seed={21}
        acting={actsFor(speaker, ["manager", "captain", "assistant"])}
      />
    </group>
  );
}

function Tunnel({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const glow = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.82 + Math.sin(clock.elapsedTime * 1.4) * 0.12;
    }
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[7, 30]} />
        <meshStandardMaterial color="#161a19" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* arcos do túnel */}
      {Array.from({ length: 10 }).map((_, i) => (
        <group key={i} position={[0, 0, 3 - i * 1.5]}>
          <mesh position={[-3.3, 1.7, 0]} receiveShadow>
            <boxGeometry args={[0.24, 3.4, 1.34]} />
            <meshStandardMaterial color={i % 2 ? "#0f1613" : "#131c17"} roughness={0.86} />
          </mesh>
          <mesh position={[3.3, 1.7, 0]} receiveShadow>
            <boxGeometry args={[0.24, 3.4, 1.34]} />
            <meshStandardMaterial color={i % 2 ? "#0f1613" : "#131c17"} roughness={0.86} />
          </mesh>
          <mesh position={[0, 3.35, 0]} receiveShadow>
            <boxGeometry args={[6.9, 0.3, 1.34]} />
            <meshStandardMaterial color="#0c120f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.16, 0]}>
            <boxGeometry args={[1.5, 0.05, 0.12]} />
            <meshBasicMaterial color={primary} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* faixas LED nas laterais */}
      <mesh position={[-3.16, 2.5, -4]}>
        <boxGeometry args={[0.04, 0.09, 20]} />
        <meshBasicMaterial color={secondary} toneMapped={false} />
      </mesh>
      <mesh position={[3.16, 2.5, -4]}>
        <boxGeometry args={[0.04, 0.09, 20]} />
        <meshBasicMaterial color={secondary} toneMapped={false} />
      </mesh>
      {/* fila de atletas */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Figure
          key={i}
          x={i % 2 ? 0.95 : -0.95}
          z={1 - Math.floor(i / 2) * 1.7}
          pose="walk"
          color={i % 2 ? primary : secondary}
          seed={i * 11 + 4}
          acting={i === 0 && actsFor(speaker, ["captain", "manager"])}
        />
      ))}
      {/* boca do túnel */}
      <mesh ref={glow} position={[0, 1.9, -12]}>
        <planeGeometry args={[6.6, 3.8]} />
        <meshBasicMaterial color="#e6fff0" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2, -11]} intensity={26} distance={22} color="#eafff2" />
      <TunnelDust />
    </group>
  );
}

function PressRoom({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const flashes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!flashes.current) return;
    flashes.current.children.forEach((child, i) => {
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const t = clock.elapsedTime * 3 + i * 1.9;
      m.opacity = Math.max(0, Math.sin(t) ** 24);
    });
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#1c2322" roughness={0.5} />
      </mesh>
      {/* painel de patrocinadores */}
      <mesh position={[0, 2.4, -4]} receiveShadow>
        <boxGeometry args={[13, 4.8, 0.2]} />
        <meshStandardMaterial color={primary} roughness={0.62} />
      </mesh>
      {Array.from({ length: 24 }).map((_, i) => (
        <mesh key={i} position={[-5.8 + (i % 6) * 2.32, 0.95 + Math.floor(i / 6) * 0.82, -3.88]}>
          <planeGeometry args={[1.0, 0.3]} />
          <meshStandardMaterial color={i % 3 ? secondary : "#0f1a14"} roughness={0.45} />
        </mesh>
      ))}
      {/* mesa, microfones e garrafa */}
      <mesh position={[0, 0.76, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.14, 1.1]} />
        <meshStandardMaterial color="#101513" roughness={0.3} metalness={0.25} />
      </mesh>
      {[-0.5, 0.45].map((x) => (
        <group key={x} position={[x, 0.84, -1.2]}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
            <meshStandardMaterial color="#0c0f0e" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#20262b" roughness={0.5} />
          </mesh>
        </group>
      ))}
      <Figure
        x={0}
        z={-1.95}
        color={secondary}
        shorts="#1a1f21"
        seed={31}
        acting={actsFor(speaker, ["manager", "president"])}
      />
      {/* fotógrafos e flashes */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Figure
          key={i}
          x={-3.4 + i * 1.7}
          z={2.4}
          rot={Math.PI}
          color="#20262b"
          seed={i * 17 + 2}
        />
      ))}
      <PressFlashes />
      <group ref={flashes}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[-3.4 + i * 1.7, 1.5, 2.1]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Crowd({
  rows = 8,
  cols = 40,
  y = 3,
  z = -14,
  tint,
}: {
  rows?: number;
  cols?: number;
  y?: number;
  z?: number;
  tint: string;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const count = rows * cols;
  const colors = useMemo(() => {
    const base = new THREE.Color(tint);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const c = base.clone().offsetHSL(0, 0, (hash(i) - 0.5) * 0.36);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [count, tint]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = -cols * 0.35 + col * 0.7 + (hash(i) - 0.5) * 0.18;
      const sway = Math.sin(t * 2 + col * 0.35 + row) * 0.05;
      matrix.makeTranslation(x, y + row * 0.62 + sway, z - row * 0.7);
      mesh.current.setMatrixAt(i, matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <capsuleGeometry args={[0.14, 0.34, 3, 6]} />
      <meshStandardMaterial vertexColors roughness={0.86} />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
}

function PitchEntry({
  primary,
  secondary,
  speaker,
  festive,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
  festive: boolean;
}) {
  return (
    <group>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh
          key={i}
          receiveShadow
          rotation-x={-Math.PI / 2}
          position={[0, i % 2 ? 0.001 : 0, 8 - i * 2.2]}
        >
          <planeGeometry args={[40, 2.2]} />
          <meshStandardMaterial color={i % 2 ? "#157a3f" : "#126b37"} roughness={0.94} />
        </mesh>
      ))}
      {/* linhas */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -4]}>
        <ringGeometry args={[4.2, 4.32, 48]} />
        <meshBasicMaterial color="#eafff2" />
      </mesh>
      {/* gol ao fundo */}
      <group position={[0, 0, -16]}>
        <mesh position={[-3.66, 1.22, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.44, 8]} />
          <meshStandardMaterial color="#f3fff7" />
        </mesh>
        <mesh position={[3.66, 1.22, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 2.44, 8]} />
          <meshStandardMaterial color="#f3fff7" />
        </mesh>
        <mesh position={[0, 2.44, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 7.32, 8]} />
          <meshStandardMaterial color="#f3fff7" />
        </mesh>
      </group>
      <Crowd tint={primary} y={2.6} z={-22} rows={7} cols={44} />
      {/* refletores */}
      {[-14, 14].map((x) => (
        <group key={x} position={[x, 0, -18]}>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 10, 8]} />
            <meshStandardMaterial color="#2a3330" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 10, 0.4]}>
            <boxGeometry args={[2.4, 0.9, 0.2]} />
            <meshBasicMaterial color="#f6fff9" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* fila de entrada + bola */}
      {Array.from({ length: 11 }).map((_, i) => (
        <Figure
          key={i}
          x={-5.2 + i * 1.06}
          z={0.4 + (i % 2) * 0.5}
          pose="walk"
          color={i < 6 ? primary : secondary}
          seed={i * 9 + 1}
          acting={i === 0 && actsFor(speaker, ["captain", "manager"])}
        />
      ))}
      {festive ? <CelebrationRain /> : null}
      <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.12}>
        <mesh position={[0, 0.18, 2.4]} castShadow>
          <sphereGeometry args={[0.16, 20, 16]} />
          <meshStandardMaterial color="#f7f9f2" roughness={0.42} />
        </mesh>
      </Float>
    </group>
  );
}

function Stands({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[48, 30]} />
        <meshStandardMaterial color="#14512c" roughness={0.95} />
      </mesh>
      <Crowd tint={primary} y={2.2} z={-12} rows={10} cols={52} />
      <Crowd tint={secondary} y={2.2} z={12} rows={5} cols={52} />
      {/* bandeirões */}
      {[-9, -3, 3, 9].map((x, i) => (
        <mesh key={x} position={[x, 3.4 + (i % 2) * 0.5, -9]} rotation-z={(hash(i) - 0.5) * 0.12}>
          <planeGeometry args={[3.4, 2]} />
          <meshStandardMaterial
            color={i % 2 ? primary : secondary}
            roughness={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {[-18, 18].map((x) => (
        <mesh key={x} position={[x, 11, -14]}>
          <boxGeometry args={[3, 1.1, 0.3]} />
          <meshBasicMaterial color="#f6fff9" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Office({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#3b2c1f" roughness={0.6} />
      </mesh>
      <mesh receiveShadow position={[0, 2.4, -4]}>
        <boxGeometry args={[16, 4.8, 0.2]} />
        <meshStandardMaterial color="#1a2420" roughness={0.9} />
      </mesh>
      {/* janela com estádio ao fundo */}
      <mesh position={[4.4, 2.2, -3.86]}>
        <planeGeometry args={[4.6, 2.6]} />
        <meshBasicMaterial color="#cfeede" toneMapped={false} />
      </mesh>
      {/* mesa e cadeiras */}
      <mesh position={[0, 0.74, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.12, 1.5]} />
        <meshStandardMaterial color="#4a3320" roughness={0.42} />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.36, -1.4]} castShadow>
          <boxGeometry args={[0.1, 0.72, 0.1]} />
          <meshStandardMaterial color="#2a1d12" roughness={0.7} />
        </mesh>
      ))}
      {/* troféus na estante */}
      <mesh position={[-4.6, 1.5, -3.8]} receiveShadow>
        <boxGeometry args={[4, 3, 0.4]} />
        <meshStandardMaterial color="#241a12" roughness={0.85} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-6.2 + i * 0.78, 2.35, -3.6]} castShadow>
          <cylinderGeometry args={[0.1, 0.14, 0.42, 10]} />
          <meshStandardMaterial color="#d8b64a" metalness={0.85} roughness={0.24} />
        </mesh>
      ))}
      <Figure
        x={-0.9}
        z={-2.3}
        rot={0.3}
        color={primary}
        shorts="#1b1f22"
        seed={41}
        acting={actsFor(speaker, ["president", "agent"])}
      />
      <Figure
        x={1.1}
        z={-2.3}
        rot={-0.25}
        color={secondary}
        shorts="#1b1f22"
        seed={57}
        acting={actsFor(speaker, ["manager", "scout"])}
      />
    </group>
  );
}

/** Chegada do ônibus: pátio noturno, faróis acesos e torcida na grade. */
function BusArrival({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const beacon = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    // giroflex do batedor: pulso azul alternado
    if (beacon.current) beacon.current.intensity = Math.sin(clock.elapsedTime * 6) > 0 ? 14 : 2;
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[26, 20]} />
        <meshStandardMaterial color="#14171b" roughness={0.55} metalness={0.15} />
      </mesh>
      {/* ônibus */}
      <group position={[0, 0, -3]}>
        <mesh position={[0, 1.55, 0]} castShadow>
          <boxGeometry args={[2.9, 2.5, 9.5]} />
          <meshStandardMaterial color={primary} roughness={0.32} metalness={0.45} />
        </mesh>
        <mesh position={[0, 2.35, 0]}>
          <boxGeometry args={[2.94, 0.7, 9.0]} />
          <meshStandardMaterial color={secondary} roughness={0.4} metalness={0.3} />
        </mesh>
        {/* para-brisa aceso */}
        <mesh position={[0, 1.9, 4.78]}>
          <planeGeometry args={[2.4, 1.1]} />
          <meshBasicMaterial color="#ffe9b0" toneMapped={false} />
        </mesh>
        {/* faróis + fachos */}
        {[-0.9, 0.9].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.65, 4.78]}>
              <sphereGeometry args={[0.13, 10, 10]} />
              <meshBasicMaterial color="#fff6d8" toneMapped={false} />
            </mesh>
            <mesh position={[x, 0.5, 7.2]} rotation-x={-Math.PI / 2 - 0.06}>
              <coneGeometry args={[0.9, 5, 12, 1, true]} />
              <meshBasicMaterial
                color="#ffedb5"
                transparent
                opacity={0.1}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
        {[3.1, -3.1].map((z) => (
          <group key={z}>
            {[-1.35, 1.35].map((x) => (
              <mesh key={x} position={[x, 0.5, z]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.5, 0.5, 0.35, 14]} />
                <meshStandardMaterial color="#0c0e10" roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* grade + torcida */}
      <mesh position={[-5.2, 0.55, -1]} castShadow>
        <boxGeometry args={[0.08, 1.1, 10]} />
        <meshStandardMaterial color="#6a737c" roughness={0.5} metalness={0.6} />
      </mesh>
      <Figure
        x={-6.1}
        z={-3.4}
        rot={1.2}
        color={primary}
        seed={71}
        acting={actsFor(speaker, ["fan"])}
      />
      <Figure x={-6.3} z={-1.1} rot={1.4} color={secondary} seed={72} />
      <Figure x={-6.0} z={1.2} rot={1.2} color={primary} seed={73} />
      {/* capitão desembarcando */}
      <Figure
        x={1.9}
        z={1.8}
        rot={-2.6}
        color={primary}
        seed={77}
        acting={actsFor(speaker, ["captain", "manager"])}
      />
      <pointLight ref={beacon} position={[-7.5, 2.2, 5]} color="#3a7bff" distance={18} />
      <pointLight position={[0, 2.4, 6]} intensity={10} distance={20} color="#ffd9a0" />
      {/* brilho do estádio ao fundo */}
      <mesh position={[0, 6, -14]}>
        <planeGeometry args={[30, 8]} />
        <meshBasicMaterial color="#bfd9ff" transparent opacity={0.28} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------- direção 3D */

/**
 * Papel de cada plano na lista de SHOTS: geral abre, médios alternam,
 * próximo aperta, contra-plano mostra o outro lado e close é o clímax.
 */
const SHOT_ROLE = ["geral", "medio", "medio", "proximo", "contra", "close"] as const;

function Director({
  kind,
  beat,
  intensity = 0,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
}: {
  kind: SetKind;
  beat: number;
  /**
   * Tensão da fala atual (0..1, vinda da direção). Tensão alta deixa o tremor
   * de mão mais presente e a aproximação de lente mais agressiva; tensão zero
   * mantém o comportamento clássico e calmo.
   */
  intensity?: number;
  /** tamanho do plano pedido pela direção (quem fala define o plano) */
  size?: "geral" | "medio" | "proximo" | "close";
  /** travelling dentro da fala: de → para (0..1), vindo da direção */
  dollyFrom?: number;
  dollyTo?: number;
  /** fala de clímax: tremor e aperto de lente no máximo */
  climax?: boolean;
}) {
  const shots = SHOTS[kind];
  // o plano respeita a direção; linhas seguidas do mesmo tamanho alternam
  // entre as duas opções médias para não repetir o enquadramento
  const roleIndex = useMemo(() => {
    const pick = (role: string, fallback: number) => {
      const options = SHOT_ROLE.map((r, idx) => (r === role ? idx : -1)).filter((v) => v >= 0);
      if (!options.length) return fallback;
      return options[beat % options.length]!;
    };
    if (size === "geral") return pick("geral", 0);
    if (size === "proximo") return pick("proximo", 3);
    if (size === "close") return pick("close", 5);
    return pick("medio", 1);
  }, [size, beat]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const current = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3());
  const started = useRef(false);
  // tempo desde a troca de plano: o corte começa devagar e acelera, como um
  // travelling de verdade, em vez de saltar para a posição nova
  const since = useRef(0);
  const lastBeat = useRef(beat);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const dolly = useRef({ from: dollyFrom, to: dollyTo });
  dolly.current.from = dollyFrom;
  dolly.current.to = dollyTo;
  const climaxRef = useRef(climax);
  climaxRef.current = climax;

  useFrame(({ camera, clock }, delta) => {
    const shot = shots[roleIndex % shots.length]!;
    const t = clock.elapsedTime;
    if (lastBeat.current !== beat) {
      lastBeat.current = beat;
      since.current = 0;
    }
    since.current += delta;

    const drift = reduced ? 0 : 1;
    // travelling lento + micro tremor de câmera na mão; a tensão multiplica o
    // tremor (até 3×) para a imagem "respirar" junto com a cena — e o clímax
    // dobra a aposta mais uma vez
    const nerves = (1 + intensity * 2) * (climaxRef.current ? 1.6 : 1);
    target.set(
      shot[0] + (Math.sin(t * 0.16) * 0.5 + Math.sin(t * 2.7) * 0.012 * nerves) * drift,
      shot[1] + (Math.sin(t * 0.21) * 0.11 + Math.sin(t * 3.1) * 0.008 * nerves) * drift,
      shot[2] + Math.cos(t * 0.13) * 0.32 * drift,
    );
    look.set(shot[3], shot[4], shot[5]);
    // push-in da direção: a câmera desliza em direção ao alvo durante a fala
    if (!reduced) {
      const travel = dolly.current.to - dolly.current.from;
      if (Math.abs(travel) > 0.001) {
        const u = Math.min(1, since.current / 4);
        const e = u * u * (3 - 2 * u);
        target.lerp(look, Math.max(-0.2, Math.min(0.4, travel * 0.55 * e)));
      }
    }
    if (!started.current) {
      current.current.copy(target);
      currentLook.current.copy(look);
      started.current = true;
    }
    // aceleração suave do plano: 0 → 1 em ~1,2 s (ease-in-out)
    const u = Math.min(1, since.current / 1.2);
    const eased = u * u * (3 - 2 * u);
    const speed = reduced ? 0.0002 : 0.02 - eased * 0.0186;
    const k = 1 - Math.pow(speed, delta);
    current.current.lerp(target, k);
    currentLook.current.lerp(look, k);
    camera.position.copy(current.current);
    camera.lookAt(currentLook.current);

    // leve aproximação de lente ao longo do plano: dá respiro cinematográfico.
    // Com tensão, a lente fecha mais (efeito de "aperto" no clímax).
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const wanted = reduced
        ? 42
        : 44 - eased * (3.4 + intensity * 3.2) - (climaxRef.current ? 3 : 0);
      if (Math.abs(cam.fov - wanted) > 0.01) {
        cam.fov += (wanted - cam.fov) * Math.min(1, delta * 2.4);
        cam.updateProjectionMatrix();
      }
    }
  });
  return null;
}

/** Luz da fala vinda da direção: o humor pinta o cenário a cada fala. */
const LINE_TINT: Record<LineLight, { sky: string; rim: string; amb: number }> = {
  neutra: { sky: "#effff4", rim: "#ffffff", amb: 1 },
  quente: { sky: "#ffe3c0", rim: "#ffb46a", amb: 1.1 },
  fria: { sky: "#c3d9ff", rim: "#7fa8ff", amb: 0.95 },
  dramatica: { sky: "#d8c9ff", rim: "#ff4d5e", amb: 0.8 },
  festa: { sky: "#fff3d6", rim: "#ffe066", amb: 1.25 },
};

function Stage({
  kind,
  beat,
  primary,
  secondary,
  mood,
  quality,
  intensity = 0,
  speaker = null,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
  light = "neutra",
  festive = false,
}: {
  kind: SetKind;
  beat: number;
  primary: string;
  secondary: string;
  mood: "good" | "bad" | "neutral";
  quality: QualityLevel;
  intensity?: number;
  speaker?: Speaker | null;
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  light?: LineLight;
  festive?: boolean;
}) {
  const base = mood === "good" ? "#fff3d6" : mood === "bad" ? "#cfe0ff" : "#effff4";
  const tint = LINE_TINT[light];
  const warm = light === "neutra" ? base : tint.sky;
  const indoor = kind === "locker" || kind === "press" || kind === "office" || kind === "tunnel";
  const amb = (indoor ? 0.34 : 0.55) * tint.amb;
  return (
    <>
      <fog
        attach="fog"
        args={[indoor ? "#070c0a" : "#0a1310", indoor ? 8 : 22, indoor ? 34 : 70]}
      />
      <ambientLight intensity={amb} color={warm} />
      <hemisphereLight intensity={0.35} color={warm} groundColor="#0a140f" />
      <directionalLight
        castShadow
        position={[5, 11, 6]}
        intensity={indoor ? 1.4 : 2.6}
        color={warm}
        shadow-mapSize={quality === "alta" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
      />
      {/* luz de recorte atrás dos personagens (tingida pela fala) */}
      <spotLight
        position={[-5, 6, -5]}
        angle={0.7}
        penumbra={0.9}
        intensity={28}
        color={light === "neutra" ? primary : tint.rim}
      />
      {quality !== "baixa" && (
        <Environment resolution={quality === "alta" ? 96 : 64} frames={1}>
          <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
          <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color={primary} />
          <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color={secondary} />
        </Environment>
      )}
      <Director
        kind={kind}
        beat={beat}
        intensity={intensity}
        size={size}
        dollyFrom={dollyFrom}
        dollyTo={dollyTo}
        climax={climax}
      />
      {kind === "locker" ? (
        <LockerRoom primary={primary} secondary={secondary} speaker={speaker} />
      ) : null}
      {kind === "tunnel" ? (
        <Tunnel primary={primary} secondary={secondary} speaker={speaker} />
      ) : null}
      {kind === "press" ? (
        <PressRoom primary={primary} secondary={secondary} speaker={speaker} />
      ) : null}
      {kind === "pitch" ? (
        <PitchEntry primary={primary} secondary={secondary} speaker={speaker} festive={festive} />
      ) : null}
      {kind === "stands" ? <Stands primary={primary} secondary={secondary} /> : null}
      {kind === "office" ? (
        <Office primary={primary} secondary={secondary} speaker={speaker} />
      ) : null}
      {kind === "arrival" ? (
        <BusArrival primary={primary} secondary={secondary} speaker={speaker} />
      ) : null}
    </>
  );
}

export const CinematicStage3D = memo(function CinematicStage3D({
  art,
  primary,
  secondary,
  beat = 0,
  mood = "neutral",
  intensity = 0,
  speaker = null,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
  light = "neutra",
}: {
  art: SceneArt;
  primary: string;
  secondary: string;
  beat?: number;
  mood?: "good" | "bad" | "neutral";
  /** tensão da fala atual (0..1): tremor de mão e aperto de lente */
  intensity?: number;
  /** quem fala agora (o figurante-herói gesticula) */
  speaker?: Speaker | null;
  /** gramática da direção: tamanho do plano, travelling e clímax da fala */
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  light?: LineLight;
}) {
  const kind = SET_BY_ART[art] ?? "locker";
  const initialQuality = useMemo(() => detectQuality(), []);
  const [quality, setQuality] = useState<QualityLevel>(initialQuality);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        shadows={quality !== "baixa"}
        dpr={quality === "alta" ? [0.9, 1.4] : quality === "media" ? [0.75, 1.1] : 0.7}
        camera={{ position: [0, 2.2, 6.5], fov: 42 }}
        gl={{ antialias: quality !== "baixa", powerPreference: "high-performance", stencil: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        <PerformanceMonitor
          flipflops={2}
          onDecline={() => setQuality((current) => lowerQuality(current))}
        />
        <Stage
          kind={kind}
          beat={beat}
          primary={primary}
          secondary={secondary}
          mood={mood}
          quality={quality}
          intensity={intensity}
          speaker={speaker}
          size={size}
          dollyFrom={dollyFrom}
          dollyTo={dollyTo}
          climax={climax}
          light={light}
          festive={(art === "trophy" || art === "celebration") && mood === "good"}
        />
        <PostFX
          quality={quality === "alta" ? "alta" : quality === "media" ? "media" : "baixa"}
          moment="drama"
          time="entardecer"
          intensity={quality === "alta" ? 0.72 : 0.5}
        />
      </Canvas>
    </div>
  );
});
