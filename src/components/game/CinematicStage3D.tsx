// ============================================================================
//  CinematicStage3D.tsx
//  Cenários 3D reais das cenas cinematográficas: vestiário, túnel, entrada em
//  campo, coletiva, arquibancada e sala da diretoria.
//
//  Cada cena tem geometria própria, luz prática (lâmpadas, refletores, flashes),
//  névoa, figurantes articulados e um "diretor de câmera" que corta a cada fala
//  e faz um travelling contínuo dentro da fala.
// ============================================================================

import { Environment, Lightformer } from "@react-three/drei";
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import type { SceneArt, Speaker } from "@/content/cutscenes";
import type { LineLight, ShotSize } from "@/game/cutscene-director";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { CinematicManner } from "@/game/cinematic-actor";
import { cinematicIdleAt } from "@/game/cinematic-actor";
import { cinematicFocus } from "@/game/cinematic-blocking";
import { CinematicActor as Figure } from "./cinematic/CinematicActor";
import { CinematicRuntime } from "./cinematic/CinematicRuntime";
import { CinematicFrameProbe } from "./cinematic/CinematicFrameProbe";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic/cinematic-runtime";
import { CinematicSetBatch, type CinematicBatchSnapshot } from "./cinematic/CinematicSetBatch";
import { GraphicsBoundary } from "./GraphicsBoundary";
import { HangingShirt, TacticsBoard, ClubTrophy } from "./cinematic/CinematicSetDetails";
import { CinematicSetFinish } from "./cinematic/CinematicSetFinish";
import {
  cinematicBackdrop,
  cinematicSurface,
  releaseCinematicBackdrop,
} from "./cinematic/cinematic-surfaces";

/** true quando o locutor da fala atual é um dos donos deste figurante-herói */
function actsFor(speaker: Speaker | null, roles: Speaker[]): boolean {
  return speaker !== null && roles.includes(speaker);
}
import { cinematicGpuQuality, cinematicInitialQuality } from "@/game/cinematic-performance";
const CinematicLens = lazy(() => import("./cinematic/CinematicLens"));
let automaticQuality: QualityLevel | undefined;
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

function hash(seed: number) {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

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
  useCinematicFrame((time, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const t = time;
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
  useCinematicFrame((_, rawDt) => {
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
  useCinematicFrame((time) => {
    if (!ref.current) return;
    const t = time;
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
  useCinematicFrame((time) => {
    if (lamp.current) lamp.current.intensity = 9 + Math.sin(time * 9.3) * 0.4;
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial
          color="#68727a"
          map={cinematicSurface("tile")}
          roughness={0.68}
          metalness={0.03}
        />
      </mesh>
      {/* paredes */}
      <mesh receiveShadow position={[0, 2.4, -4.4]}>
        <boxGeometry args={[18, 4.8, 0.2]} />
        <meshStandardMaterial color="#343e48" map={cinematicSurface("wall")} roughness={0.9} />
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
            <meshStandardMaterial color="#35454f" roughness={0.72} />
          </mesh>
          <mesh position={[0, 0.42, 0.34]} castShadow>
            <boxGeometry args={[1.42, 0.12, 0.62]} />
            <meshStandardMaterial color="#5a4128" roughness={0.85} />
          </mesh>
          <HangingShirt color={i % 2 ? secondary : primary} number={i + 5} />
          <mesh position={[0.53, 2.1, 0.35]}>
            <boxGeometry args={[0.035, 0.3, 0.04]} />
            <meshStandardMaterial color="#8b9299" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {/* banco central e quadro tático */}
      <mesh position={[0, 0.44, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[6.4, 0.16, 0.72]} />
        <meshStandardMaterial color="#987c57" map={cinematicSurface("wood")} roughness={0.72} />
      </mesh>
      <TacticsBoard />
      {/* lâmpadas práticas */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 3.5, -1]}>
          <boxGeometry args={[2.6, 0.08, 0.3]} />
          <meshBasicMaterial color="#e9fff1" toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={lamp} position={[0, 3.3, -1]} intensity={9} distance={14} color="#fff0dc" />
      <Figure x={-1.9} z={0.6} rot={0.2} pose="sit" color={primary} seed={2} />
      <Figure
        x={-0.4}
        z={0.6}
        rot={-0.1}
        pose="sit"
        color={primary}
        seed={5}
        role="captain"
        acting={speaker === "captain"}
      />
      <Figure x={1.4} z={0.6} rot={0.12} pose="sit" color={secondary} seed={9} />
      <Figure x={2.9} z={0.6} rot={-0.25} pose="sit" color={primary} seed={13} />
      <Figure
        x={0.2}
        z={-2.1}
        rot={0.08}
        color="#1d2b24"
        seed={21}
        role="manager"
        acting={actsFor(speaker, ["manager", "assistant"])}
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
  useCinematicFrame((time) => {
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.82 + Math.sin(time * 1.4) * 0.12;
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
          role={i === 0 ? "captain" : undefined}
          pose="stand"
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
  const backdrop = useMemo(() => cinematicBackdrop(primary, secondary), [primary, secondary]);
  useEffect(() => () => releaseCinematicBackdrop(backdrop), [backdrop]);
  const flashes = useRef<THREE.Group>(null);
  useCinematicFrame((time) => {
    if (!flashes.current) return;
    flashes.current.children.forEach((child, i) => {
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const t = time * 3 + i * 1.9;
      m.opacity = Math.max(0, Math.sin(t) ** 24);
    });
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#65727d" map={cinematicSurface("tile")} roughness={0.65} />
      </mesh>
      {/* painel de patrocinadores */}
      <mesh position={[0, 2.4, -4]} receiveShadow>
        <boxGeometry args={[13, 4.8, 0.2]} />
        <meshStandardMaterial color="#21303b" roughness={0.72} />
      </mesh>
      <mesh position={[0, 2.45, -3.88]}>
        <planeGeometry args={[12.6, 4.25]} />
        <meshStandardMaterial map={backdrop} roughness={0.78} />
      </mesh>
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
        role="manager"
        attention={[-3.4, 2.4]}
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
          role={i === 0 ? "press" : undefined}
          attention={[0, -1.95]}
          acting={i === 0 && speaker === "press"}
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

  useCinematicFrame((time) => {
    if (!mesh.current) return;
    const t = time;
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
          x={festive && i === 0 ? 0 : festive && i === 5 ? -5.2 : -5.2 + i * 1.06}
          z={0.4 + (i % 2) * 0.5}
          role={i === 0 ? "captain" : undefined}
          holdingTrophy={festive && i === 0}
          pose="stand"
          color={i < 6 ? primary : secondary}
          seed={i * 9 + 1}
          acting={i === 0 && actsFor(speaker, ["captain", "manager"])}
        />
      ))}
      {festive ? <CelebrationRain /> : null}
      <mesh position={[0, 0.11, 2.4]} castShadow>
        <sphereGeometry args={[0.11, 20, 16]} />
        <meshStandardMaterial color="#f7f9f2" roughness={0.42} />
      </mesh>
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
        <meshStandardMaterial color="#866c50" map={cinematicSurface("wood")} roughness={0.66} />
      </mesh>
      <mesh receiveShadow position={[0, 2.4, -4]}>
        <boxGeometry args={[16, 4.8, 0.2]} />
        <meshStandardMaterial color="#384653" map={cinematicSurface("wall")} roughness={0.9} />
      </mesh>
      {/* janela com estádio ao fundo */}
      <mesh position={[4.4, 2.2, -3.86]}>
        <planeGeometry args={[4.6, 2.6]} />
        <meshBasicMaterial color="#9ab7cc" />
      </mesh>
      {/* mesa e cadeiras */}
      <mesh position={[0, 0.74, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.12, 1.5]} />
        <meshStandardMaterial color="#a7875d" map={cinematicSurface("wood")} roughness={0.5} />
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
        <ClubTrophy key={i} x={-6.2 + i * 0.78} y={2.05} z={-3.6} scale={0.8} />
      ))}
      <Figure
        x={-0.9}
        z={-2.3}
        rot={0.3}
        color={primary}
        shorts="#1b1f22"
        seed={41}
        role="president"
        attention={[1.1, -2.3]}
        acting={actsFor(speaker, ["president", "agent"])}
      />
      <Figure
        x={1.1}
        z={-2.3}
        rot={-0.25}
        color={secondary}
        shorts="#1b1f22"
        seed={57}
        role="manager"
        attention={[-0.9, -2.3]}
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
  useCinematicFrame((time) => {
    // giroflex do batedor: pulso azul alternado
    if (beacon.current) beacon.current.intensity = Math.sin(time * 6) > 0 ? 14 : 2;
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
        {/* Tinted windshield reflects the court lighting instead of glowing. */}
        <mesh position={[0, 1.9, 4.78]}>
          <planeGeometry args={[2.4, 1.1]} />
          <meshStandardMaterial color="#273c4b" roughness={0.22} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.9, 4.8]}>
          <boxGeometry args={[0.045, 1.1, 0.025]} />
          <meshStandardMaterial color="#151d24" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.97, 4.8]}>
          <boxGeometry args={[1.6, 0.25, 0.045]} />
          <meshStandardMaterial color="#202c34" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.45, 4.82]}>
          <boxGeometry args={[2.7, 0.15, 0.06]} />
          <meshStandardMaterial color="#a3afb7" roughness={0.35} metalness={0.7} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 1.6, 2.05, 4.5]}>
              <boxGeometry args={[0.16, 0.45, 0.22]} />
              <meshStandardMaterial color="#18232b" roughness={0.5} />
            </mesh>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} position={[side * 1.48, 2.3, -3.6 + i * 1.13]}>
                <boxGeometry args={[0.025, 0.62, 0.97]} />
                <meshStandardMaterial color="#293b49" roughness={0.22} metalness={0.6} />
              </mesh>
            ))}
          </group>
        ))}
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
        role="fan"
        acting={actsFor(speaker, ["fan"])}
      />
      <Figure x={-6.3} z={-1.1} rot={1.4} color={secondary} seed={72} />
      <Figure x={-6.0} z={1.2} rot={1.2} color={primary} seed={73} />
      {/* capitão desembarcando */}
      <Figure
        x={1.9}
        z={1.8}
        rot={0.1}
        color={primary}
        seed={77}
        role="captain"
        acting={actsFor(speaker, ["captain", "manager"])}
      />
      <pointLight ref={beacon} position={[-7.5, 2.2, 5]} color="#3a7bff" distance={18} />
      <pointLight position={[0, 2.4, 6]} intensity={10} distance={20} color="#ffd9a0" />
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
  speaker = null,
  festive = false,
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
  speaker?: Speaker | null;
  festive?: boolean;
}) {
  const runtime = useCinematicRuntime();
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

  useFrame(({ camera }) => {
    const delta = runtime.clock.dt;
    const time = runtime.clock.time;
    const shot = shots[roleIndex % shots.length]!;
    const t = time;
    if (lastBeat.current !== beat) {
      lastBeat.current = beat;
      since.current = 0;
      if (delta === 0) started.current = false;
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
    const focus = cinematicFocus(kind, speaker, festive);
    if (focus && size !== "geral") {
      const lens = size === "close" ? 1.35 : size === "proximo" ? 2.35 : 3.6;
      const enclosed = kind === "locker" || kind === "press" || kind === "office";
      const narrow =
        camera instanceof THREE.PerspectiveCamera
          ? Math.min(enclosed ? 1.35 : 1.85, Math.max(1, 0.72 / camera.aspect))
          : 1;
      const offset = (beat % 2 ? -1 : 1) * (size === "close" ? 0.35 : 0.85);
      const seated = kind === "locker" && speaker === "captain";
      const seatedIdle = seated ? cinematicIdleAt(time, 5, true) : null;
      const rise = seatedIdle?.kind === "rise" ? seatedIdle.weight * 0.45 : 0;
      const subjectY =
        rise +
        (size === "close"
          ? seated
            ? 1.09
            : 1.58
          : size === "proximo"
            ? seated
              ? 0.98
              : 1.35
            : seated
              ? 0.8
              : 1.25);
      target.set(
        focus[0] + offset,
        subjectY + 0.12,
        focus[1] + lens * narrow * (kind === "press" && speaker === "press" ? -1 : 1),
      );
      look.set(focus[0], subjectY, focus[1]);
    }
    // push-in da direção: a câmera desliza em direção ao alvo durante a fala
    if (!reduced) {
      const travel = dolly.current.to - dolly.current.from;
      if (Math.abs(travel) > 0.001) {
        const u = Math.min(1, since.current / 4);
        const e = u * u * (3 - 2 * u);
        target.lerp(look, Math.max(-0.2, Math.min(0.4, travel * 0.55 * e)));
      }
    }
    if (kind === "locker" || kind === "press" || kind === "office") {
      target.x = THREE.MathUtils.clamp(target.x, -6.5, 6.5);
      target.z = THREE.MathUtils.clamp(target.z, -3.5, 6.6);
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
    runtime.focus.copy(currentLook.current);
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
  enhanced = true,
  onBatch,
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
  enhanced?: boolean;
  onBatch?: ((snapshot: CinematicBatchSnapshot) => void) | undefined;
}) {
  const base = mood === "good" ? "#fff3e1" : mood === "bad" ? "#d8e3fa" : "#eef2f7";
  const tint = LINE_TINT[light];
  const warm = light === "neutra" ? base : tint.sky;
  const indoor = kind === "locker" || kind === "press" || kind === "office" || kind === "tunnel";
  const amb = (indoor ? 0.46 : 0.55) * tint.amb;
  return (
    <>
      <fog
        attach="fog"
        args={[indoor ? "#0b1017" : "#0a1310", indoor ? 8 : 22, indoor ? 34 : 70]}
      />
      <ambientLight intensity={amb} color={warm} />
      <hemisphereLight intensity={indoor ? 0.65 : 0.45} color="#dce8f4" groundColor="#30333a" />
      {indoor ? (
        <>
          <directionalLight position={[0, 2.5, 6]} intensity={0.75} color="#e8f0f7" />
          <directionalLight
            position={[-4, 3, -4]}
            intensity={kind === "press" ? 0.9 : 0.45}
            color="#d4e3ff"
          />
        </>
      ) : null}
      <directionalLight
        castShadow
        position={[5, 11, 6]}
        intensity={indoor ? 1.9 : 2.6}
        color={light === "neutra" ? "#fff8f2" : warm}
        shadow-mapSize={quality === "alta" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-camera-left={indoor ? -12 : -24}
        shadow-camera-right={indoor ? 12 : 24}
        shadow-camera-top={indoor ? 10 : 22}
        shadow-camera-bottom={indoor ? -10 : -22}
      />
      {/* Neutral rim preserves the complexion; club colour stays in the set. */}
      <spotLight
        position={[-5, 6, -5]}
        angle={0.7}
        penumbra={0.9}
        intensity={indoor ? 12 : 22}
        color={light === "neutra" ? "#d4e6ff" : tint.rim}
      />
      {enhanced && quality !== "baixa" && (
        <Environment resolution={quality === "alta" ? 96 : 64} frames={1}>
          <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
          <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color="#d6e5f4" />
          <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={0.8} color="#e6dfd3" />
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
        speaker={speaker}
        festive={festive}
      />
      <CinematicSetBatch key={`${kind}-${primary}-${secondary}`} onReady={onBatch}>
        <CinematicSetFinish kind={kind} primary={primary} />
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
      </CinematicSetBatch>
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
  paused = false,
  reduced = false,
  look,
  cast,
  onUnavailable,
  qualityMode = "auto",
  manner,
  onReady,
  previewTime,
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
  paused?: boolean;
  reduced?: boolean;
  look?: ManagerLook | undefined;
  cast?: Cast | undefined;
  onUnavailable?: (() => void) | undefined;
  qualityMode?: QualityLevel | "auto";
  manner?: CinematicManner | undefined;
  onReady?: (() => void) | undefined;
  previewTime?: number | undefined;
}) {
  const kind = SET_BY_ART[art] ?? "locker";
  const initialQuality = useMemo(() => detectQuality(), []);
  const [quality, setQuality] = useState<QualityLevel>(
    qualityMode === "auto" && automaticQuality
      ? automaticQuality
      : cinematicInitialQuality(initialQuality, qualityMode),
  );
  useEffect(() => {
    setQuality(
      qualityMode === "auto" && automaticQuality
        ? automaticQuality
        : cinematicInitialQuality(initialQuality, qualityMode),
    );
  }, [qualityMode, initialQuality]);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const stageReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  useEffect(() => {
    if (!ready || paused || reduced || hidden || quality === "baixa") return;
    const timer = window.setTimeout(() => startTransition(() => setEnhanced(true)), 200);
    return () => window.clearTimeout(timer);
  }, [ready, paused, reduced, hidden, quality]);
  const host = useRef<HTMLDivElement>(null);
  const openedAt = useRef(performance.now());
  const onBatch = useCallback(({ sources, batches, visibleSources }: CinematicBatchSnapshot) => {
    if (!host.current) return;
    host.current.dataset["staticSources"] = String(sources);
    host.current.dataset["staticBatches"] = String(batches);
    host.current.dataset["staticVisibleSources"] = String(visibleSources);
  }, []);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed();
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  return (
    <div
      ref={host}
      className="absolute inset-0"
      data-cinematic-set={kind}
      data-cinematic-quality={quality}
    >
      <GraphicsBoundary
        fallback={
          <button
            type="button"
            onClick={onUnavailable}
            className="absolute inset-0 z-10 bg-background p-8 text-white"
          >
            A cena 3D não carregou. Abrir cena ilustrada.
          </button>
        }
      >
        <Canvas
          frameloop={paused || reduced || hidden ? "demand" : "always"}
          shadows={quality !== "baixa"}
          dpr={quality === "alta" ? [0.9, 1.4] : quality === "media" ? [0.75, 1.1] : 0.7}
          camera={{ position: [0, 2.2, 6.5], fov: 42, near: 0.05, far: 90 }}
          gl={{
            antialias: quality !== "baixa",
            powerPreference: "high-performance",
            stencil: false,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.type = THREE.PCFShadowMap;
            gl.info.autoReset = false;
            const context = gl.getContext();
            const debug = context.getExtension("WEBGL_debug_renderer_info");
            if (debug) {
              const renderer = String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL));
              if (host.current) host.current.dataset["cinematicGpu"] = renderer;
              if (qualityMode === "auto") {
                automaticQuality = cinematicGpuQuality(quality, renderer);
                setQuality(automaticQuality);
              }
            }
          }}
          fallback={
            <button
              type="button"
              onClick={onUnavailable}
              className="absolute inset-0 z-10 bg-background p-8 text-white"
            >
              O 3D está indisponível neste navegador. Abrir cena ilustrada.
            </button>
          }
        >
          {qualityMode === "auto" && !paused && !reduced && !hidden ? (
            <PerformanceMonitor
              flipflops={2}
              bounds={() => [24, 45]}
              iterations={3}
              threshold={0.8}
              onDecline={() =>
                setQuality((current) => {
                  automaticQuality = lowerQuality(current);
                  return automaticQuality;
                })
              }
              onFallback={() => {
                automaticQuality = "baixa";
                setQuality("baixa");
              }}
            />
          ) : null}
          <CinematicRuntime
            quality={quality}
            look={look}
            cast={cast}
            stopped={paused || hidden}
            reduced={reduced}
            manner={manner}
            previewTime={previewTime}
          >
            <CinematicFrameProbe
              host={host}
              openedAt={openedAt.current}
              stopped={paused || reduced || hidden}
              onReady={stageReady}
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
              onBatch={onBatch}
              enhanced={enhanced}
            />
            {enhanced && quality !== "baixa" ? (
              <Suspense fallback={null}>
                <CinematicLens quality={quality} />
              </Suspense>
            ) : null}
          </CinematicRuntime>
        </Canvas>
      </GraphicsBoundary>
    </div>
  );
});
