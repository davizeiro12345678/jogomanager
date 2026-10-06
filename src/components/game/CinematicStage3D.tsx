// ============================================================================
//  CinematicStage3D.tsx
//  Cenários 3D reais das cenas cinematográficas: vestiário, túnel, entrada em
//  campo, coletiva, arquibancada e sala da diretoria.
//
//  Cada cena tem geometria própria, luz prática (lâmpadas, refletores, flashes),
//  névoa, figurantes articulados e um "diretor de câmera" que corta a cada fala
//  e faz um travelling contínuo dentro da fala.
// ============================================================================

import { useDisposable } from "./useDisposable";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
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
import type { CinematicVoiceClockRef } from "@/game/cutscene-visemes";
import { cinematicIdleAt } from "@/game/cinematic-actor";
import { supportsWebGL } from "@/game/webgl-support";
import {
  cinematicCameraTransition,
  type CinematicCameraTransitionInput,
} from "@/game/cinematic-camera-transition";
import { cinematicShotFor } from "@/game/cinematic-shot";
import { cinematicDrillFor } from "@/game/cinematic-action";
import {
  cinematicReactionReady,
  cinematicReactionSpeaker,
  cinematicSetFor,
  cinematicStageActorFor,
  type CinematicSet,
} from "@/game/cinematic-blocking";
import { hashSeed } from "@/game/rng";
import { CinematicCrowd } from "./cinematic/CinematicCrowd";
import type { CinematicCue } from "@/game/cinematic-cue";
import { CinematicAtmosphere } from "./cinematic/CinematicAtmosphere";
import { CinematicTraining } from "./cinematic/CinematicTraining";
import { CinematicSpecialSet } from "./cinematic/CinematicSpecialSet";
import { CinematicPortraitLight } from "./cinematic/CinematicPortraitLight";
import { CinematicActor as Figure } from "./cinematic/CinematicActor";
import { CinematicRuntime } from "./cinematic/CinematicRuntime";
import { CinematicFrameProbe } from "./cinematic/CinematicFrameProbe";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic/cinematic-runtime";
import { CinematicSetBatch, type CinematicBatchSnapshot } from "./cinematic/CinematicSetBatch";
import { GraphicsBoundary } from "./GraphicsBoundary";
import { HangingShirt, TacticsBoard, ClubTrophy } from "./cinematic/CinematicSetDetails";
import { CinematicSetFinish } from "./cinematic/CinematicSetFinish";
import { CinematicStoryDressing } from "./cinematic/CinematicStoryDressing";
import { CinematicMotivatedLight } from "./cinematic/CinematicMotivatedLight";
import {
  cinematicBackdrop,
  cinematicSurface,
  releaseCinematicBackdrop,
} from "./cinematic/cinematic-surfaces";

import {
  cinematicAutoQualityOnDecline,
  cinematicAutoQualityOnFallback,
  cinematicAutoQualityOnIncline,
  cinematicGpuQuality,
  cinematicInitialQuality,
} from "@/game/cinematic-performance";
const CinematicLens = lazy(() => import("./cinematic/CinematicLens"));
import { detectQuality, dprFor, type QualityLevel } from "@/game/device";
import { Button } from "@/components/ui/button";

type SetKind = CinematicSet;

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
      if (p.y < 0.05) p.y = 8 + hash(i * 19 + Math.floor(t * 0.25)) * 2;
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
  const geo = useDisposable(() => {
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
          normalMap={cinematicSurface("tile", "normal")}
          normalScale={[0.22, 0.22]}
          roughnessMap={cinematicSurface("tile", "roughness")}
          roughness={0.68}
          metalness={0.03}
        />
      </mesh>
      {/* paredes */}
      <mesh receiveShadow position={[0, 2.4, -4.4]}>
        <boxGeometry args={[18, 4.8, 0.2]} />
        <meshStandardMaterial
          color="#343e48"
          map={cinematicSurface("wall")}
          normalMap={cinematicSurface("wall", "normal")}
          normalScale={[0.08, 0.08]}
          roughnessMap={cinematicSurface("wall", "roughness")}
          roughness={0.9}
        />
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
        <meshStandardMaterial
          color="#987c57"
          map={cinematicSurface("wood")}
          normalMap={cinematicSurface("wood", "normal")}
          normalScale={[0.2, 0.2]}
          roughnessMap={cinematicSurface("wood", "roughness")}
          roughness={0.72}
        />
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
        attention={[0.2, -2.1]}
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
        attention={[-0.4, 0.6]}
        acting={speaker === "manager"}
        clipboard
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
        <meshStandardMaterial
          color="#50565a"
          map={cinematicSurface("asphalt")}
          normalMap={cinematicSurface("asphalt", "normal")}
          normalScale={[0.12, 0.12]}
          roughnessMap={cinematicSurface("asphalt", "roughness")}
          roughness={0.82}
        />
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
          acting={i === 0 && speaker === "captain"}
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
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial
          color="#65727d"
          map={cinematicSurface("tile")}
          normalMap={cinematicSurface("tile", "normal")}
          normalScale={[0.22, 0.22]}
          roughnessMap={cinematicSurface("tile", "roughness")}
          roughness={0.65}
        />
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
        acting={speaker === "manager"}
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
          costume="staff"
          clipboard={i === 0}
        />
      ))}
      <PressFlashes />
    </group>
  );
}

function PitchEntry({
  primary,
  secondary,
  speaker,
  festive,
  training = false,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
  festive: boolean;
  training?: boolean;
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
          <meshStandardMaterial
            color={i % 2 ? "#337b43" : "#2c6e3b"}
            map={cinematicSurface("grass")}
            normalMap={cinematicSurface("grass", "normal")}
            normalScale={[0.14, 0.14]}
            roughnessMap={cinematicSurface("grass", "roughness")}
            roughness={0.94}
          />
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
      {/* Terraces support the crowd silhouettes in daylight as well as night. */}
      {Array.from({ length: 7 }, (_, row) => (
        <mesh key={row} position={[0, (2.28 + row * 0.62) / 2, -22 - row * 0.7]} receiveShadow>
          <boxGeometry args={[33, 2.28 + row * 0.62, 0.8]} />
          <meshStandardMaterial color={row % 2 ? "#536371" : "#5c6c7a"} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, -21.52]} receiveShadow>
        <boxGeometry args={[33, 1.1, 0.08]} />
        <meshStandardMaterial color={secondary} roughness={0.85} />
      </mesh>
      <CinematicCrowd
        secondary={secondary}
        festive={festive}
        tint={primary}
        y={2.6}
        z={-22}
        rows={7}
        cols={44}
      />
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
      {training ? (
        <CinematicTraining primary={primary} secondary={secondary} speaker={speaker} />
      ) : (
        Array.from({ length: 11 }).map((_, i) => (
          <Figure
            key={i}
            x={festive && i === 0 ? 0 : festive && i === 5 ? -5.2 : -5.2 + i * 1.06}
            z={0.4 + (i % 2) * 0.5}
            role={i === 0 ? "captain" : undefined}
            holdingTrophy={festive && i === 0}
            pose="stand"
            color={i < 6 ? primary : secondary}
            seed={i * 9 + 1}
            acting={i === 0 && speaker === "captain"}
          />
        ))
      )}
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
      {[
        { z: -12, rows: 10 },
        { z: 12, rows: 5 },
      ].map((section) =>
        Array.from({ length: section.rows }, (_, row) => (
          <mesh
            key={section.z + "-" + row}
            position={[0, (1.84 + row * 0.62) / 2, section.z - row * 0.7]}
            receiveShadow
          >
            <boxGeometry args={[37, 1.84 + row * 0.62, 0.75]} />
            <meshStandardMaterial color={row % 2 ? "#465e70" : "#536b7d"} roughness={0.92} />
          </mesh>
        )),
      )}
      <CinematicCrowd
        secondary={primary}
        festive
        tint={primary}
        y={2.2}
        z={-12}
        rows={10}
        cols={52}
      />
      <CinematicCrowd
        secondary={primary}
        festive
        tint={secondary}
        y={2.2}
        z={12}
        rows={5}
        cols={52}
      />
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
        <meshStandardMaterial
          color="#866c50"
          map={cinematicSurface("wood")}
          normalMap={cinematicSurface("wood", "normal")}
          normalScale={[0.2, 0.2]}
          roughnessMap={cinematicSurface("wood", "roughness")}
          roughness={0.66}
        />
      </mesh>
      <mesh receiveShadow position={[0, 2.4, -4]}>
        <boxGeometry args={[16, 4.8, 0.2]} />
        <meshStandardMaterial
          color="#384653"
          map={cinematicSurface("wall")}
          normalMap={cinematicSurface("wall", "normal")}
          normalScale={[0.08, 0.08]}
          roughnessMap={cinematicSurface("wall", "roughness")}
          roughness={0.9}
        />
      </mesh>
      {/* janela com estádio ao fundo */}
      <mesh position={[4.4, 2.2, -3.86]}>
        <planeGeometry args={[4.6, 2.6]} />
        <meshBasicMaterial color="#9ab7cc" />
      </mesh>
      {/* mesa e cadeiras */}
      <mesh position={[0, 0.74, -1.4]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.12, 1.5]} />
        <meshStandardMaterial
          color="#a7875d"
          map={cinematicSurface("wood")}
          normalMap={cinematicSurface("wood", "normal")}
          normalScale={[0.18, 0.18]}
          roughnessMap={cinematicSurface("wood", "roughness")}
          roughness={0.5}
        />
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
        acting={speaker === "president"}
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
        acting={speaker === "manager"}
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
    // Sinalizador prático junto à grade: permanece localizado e não lava a câmera.
    if (beacon.current) beacon.current.intensity = Math.sin(time * 6) > 0 ? 2.8 : 0.35;
  });
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[26, 20]} />
        <meshStandardMaterial
          color="#14171b"
          map={cinematicSurface("asphalt")}
          normalMap={cinematicSurface("asphalt", "normal")}
          normalScale={[0.18, 0.18]}
          roughnessMap={cinematicSurface("asphalt", "roughness")}
          roughness={0.82}
          metalness={0.02}
        />
      </mesh>
      {/* ônibus */}
      <group position={[0, 0, -3]}>
        <RoundedBox
          position={[0, 1.55, 0]}
          args={[2.9, 2.5, 9.5]}
          radius={0.12}
          smoothness={3}
          castShadow
        >
          <meshStandardMaterial color={primary} roughness={0.32} metalness={0.45} />
        </RoundedBox>
        <RoundedBox
          position={[0, 2.55, -0.12]}
          args={[2.82, 0.42, 8.9]}
          radius={0.09}
          smoothness={3}
        >
          <meshStandardMaterial color={secondary} roughness={0.4} metalness={0.3} />
        </RoundedBox>
        {/* Para-brisa escuro e moldura dão profundidade ao volume frontal. */}
        <RoundedBox
          position={[0, 1.98, 4.79]}
          args={[2.52, 1.2, 0.08]}
          radius={0.09}
          smoothness={3}
        >
          <meshStandardMaterial color="#182833" roughness={0.34} metalness={0.58} />
        </RoundedBox>
        <RoundedBox
          position={[0, 2, 4.842]}
          args={[2.35, 1.03, 0.035]}
          radius={0.07}
          smoothness={3}
        >
          <meshPhysicalMaterial color="#0d1b25" roughness={0.2} metalness={0.5} clearcoat={0.65} />
        </RoundedBox>
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
                <boxGeometry args={[0.035, 0.64, 0.99]} />
                <meshPhysicalMaterial
                  color="#142631"
                  roughness={0.24}
                  metalness={0.52}
                  clearcoat={0.5}
                />
              </mesh>
            ))}
            <mesh position={[side * 1.475, 1.02, -0.1]}>
              <boxGeometry args={[0.035, 0.12, 8.45]} />
              <meshStandardMaterial color={secondary} roughness={0.42} metalness={0.36} />
            </mesh>
          </group>
        ))}
        {/* Lentes práticas: iluminam a frente sem cones transparentes na imagem. */}
        {[-0.9, 0.9].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.68, 4.83]}>
              <sphereGeometry args={[0.115, 14, 12]} />
              <meshBasicMaterial color="#fff6d8" toneMapped={false} />
            </mesh>
            <pointLight position={[x, 0.72, 5.05]} intensity={1.8} distance={7} color="#ffe8b5" />
          </group>
        ))}
        {[3.1, -3.1].map((z) => (
          <group key={z}>
            {[-1.35, 1.35].map((x) => (
              <group key={x} position={[x, 0.5, z]} rotation-z={Math.PI / 2}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.5, 0.5, 0.35, 18]} />
                  <meshStandardMaterial color="#101316" roughness={0.82} />
                </mesh>
                <mesh position={[0, 0.19, 0]}>
                  <cylinderGeometry args={[0.24, 0.24, 0.025, 16]} />
                  <meshStandardMaterial color="#89949a" metalness={0.78} roughness={0.3} />
                </mesh>
              </group>
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
        acting={speaker === "fan"}
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
        entrance
        attention={[-6.1, -3.4]}
        acting={speaker === "captain"}
      />
      <pointLight ref={beacon} position={[-5.05, 1.45, 4]} color="#3a7bff" distance={6} />
      <pointLight position={[0, 2.1, 5.4]} intensity={3.6} distance={13} color="#ffd9a0" />
    </group>
  );
}

/* ----------------------------------------------------------- direção 3D */

/** Editing cuts establish geography before a face; cameras never fly through actors. */
function Director({
  kind,
  art,
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
  art?: SceneArt;
  beat: number;
  intensity?: number;
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  speaker?: Speaker | null;
  festive?: boolean;
}) {
  const runtime = useCinematicRuntime();
  const position = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const lastFraming = useRef<CinematicCameraTransitionInput | null>(null);
  useFrame(({ camera }) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const { time, lineTime } = runtime.clock;
    const opening = beat === 0 && lineTime < 1.45 && !runtime.reduced;
    const drill = cinematicDrillFor(runtime.cue?.id.split(":")[0]);
    const sceneArt = art ?? "dressing";
    const speakingActor = cinematicStageActorFor(sceneArt, speaker, festive, time, drill);
    const listener = cinematicReactionSpeaker(kind, speaker, art);
    const listenerActor = listener
      ? cinematicStageActorFor(sceneArt, listener, festive, time, drill)
      : null;
    const reaction =
      cinematicReactionReady(
        lineTime,
        runtime.cue?.duration ?? 5,
        runtime.voicePlayingRef?.current ?? false,
        Boolean(runtime.cue && !runtime.cue.decision && !opening && !festive),
      ) && listenerActor?.presence === "resident";
    const stagedActor = reaction ? listenerActor : speakingActor;
    const subject = stagedActor?.role ?? null;
    const shotSize = reaction ? "medio" : size;
    const shot = cinematicShotFor(
      kind,
      subject,
      shotSize,
      camera.aspect,
      festive,
      opening,
      art,
      beat,
      time,
      drill,
    );
    position.fromArray(shot.position);
    target.fromArray(shot.target);
    const framing: CinematicCameraTransitionInput = {
      scene: sceneArt,
      framing: shot.framing,
      subject: subject ?? "environment",
      size: shotSize,
      reaction,
      opening,
    };
    const cut = cinematicCameraTransition(lastFraming.current, framing) === "cut";
    lastFraming.current = framing;
    const focus = shotSize !== "geral" && shot.framing === "dialogue";
    if (focus && kind === "locker" && art !== "gym" && art !== "medical" && subject === "captain") {
      const idle = cinematicIdleAt(time, 5, true);
      const rise = idle.kind === "rise" ? idle.weight * 0.45 : 0;
      position.y += rise;
      target.y += rise;
    }
    if (!runtime.reduced) {
      const u = Math.min(1, lineTime / Math.max(3, runtime.cue?.duration ?? 5));
      const eased = u * u * (3 - 2 * u);
      const travel = THREE.MathUtils.clamp((dollyTo - dollyFrom) * 0.18 * eased, -0.04, 0.13);
      position.lerp(target, travel);
      // Dolly on a small arc, with sub-centimetre handheld only on tense lines.
      const motion = focus ? 0.045 : 0.16;
      position.x += Math.sin(lineTime * 0.27) * motion;
      position.y += Math.sin(time * 1.3) * intensity * 0.003;
      position.z += Math.sin(lineTime * 0.2) * motion * 0.5;
    }
    // A cut snaps to a composed shot. Only the movement inside that shot drifts.
    if (cut || runtime.stopped || runtime.reduced) {
      camera.position.copy(position);
      runtime.focus.copy(target);
    } else {
      const k = 1 - Math.exp(-8 * runtime.clock.dt);
      camera.position.lerp(position, k);
      runtime.focus.lerp(target, k);
    }
    camera.lookAt(runtime.focus);
    const fov = shot.fov - (climax && focus ? 1 : 0);
    const nextFov =
      cut || runtime.stopped || runtime.reduced
        ? fov
        : THREE.MathUtils.damp(camera.fov, fov, 8, runtime.clock.dt);
    if (Math.abs(camera.fov - nextFov) > 0.01) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    camera.userData["cinematicFraming"] = shot.framing;
    camera.userData["cinematicSubject"] = stagedActor?.role ?? "environment";
    camera.userData["cinematicActorPresence"] = stagedActor?.presence ?? "environment";
    camera.userData["cinematicShotType"] =
      opening || shot.framing === "establishing" ? "master" : reaction ? "reaction" : "dialogue";
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
  art,
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
  art: SceneArt;
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
  const amb = (indoor ? 0.34 : 0.5) * tint.amb;
  // Existing fixtures retain their own detailed rigs. Every other authored
  // speaker receives one semantic overlay, shared by the camera resolver.
  const stagedActor = cinematicStageActorFor(art, speaker, festive);
  const residentSpeaker = stagedActor?.presence === "resident" ? stagedActor.role : null;
  return (
    <>
      <color
        attach="background"
        args={[art === "training" ? "#83a8ba" : indoor ? "#0b1017" : "#101b29"]}
      />
      <fog
        attach="fog"
        args={[
          art === "training" ? "#83a8ba" : indoor ? "#0b1017" : "#0a1310",
          indoor ? 8 : 22,
          indoor ? 34 : 70,
        ]}
      />
      <ambientLight intensity={amb} color={warm} />
      <hemisphereLight intensity={indoor ? 0.4 : 0.45} color="#dce8f4" groundColor="#30333a" />
      {indoor ? (
        <>
          <directionalLight position={[0, 2.5, 6]} intensity={0.38} color="#e8f0f7" />
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
        intensity={indoor ? 1.55 : 2.6}
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
      <CinematicMotivatedLight kind={kind} art={art} mood={mood} light={light} quality={quality} />
      {enhanced && quality !== "baixa" && (
        <Environment resolution={quality === "alta" ? 96 : 64} frames={1}>
          <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
          <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color="#d6e5f4" />
          <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={0.8} color="#e6dfd3" />
        </Environment>
      )}
      <Director
        kind={kind}
        art={art}
        beat={beat}
        intensity={intensity}
        size={size}
        dollyFrom={dollyFrom}
        dollyTo={dollyTo}
        climax={climax}
        speaker={speaker}
        festive={festive}
      />
      <CinematicAtmosphere kind={kind} art={art} mood={mood} quality={quality} />
      <CinematicPortraitLight />
      <CinematicSetBatch key={`${art}-${kind}-${quality}`} onReady={onBatch}>
        {art !== "medical" && art !== "gym" && <CinematicSetFinish kind={kind} primary={primary} />}
        <CinematicStoryDressing
          kind={kind}
          art={art}
          primary={primary}
          secondary={secondary}
          quality={quality}
        />
        {art === "medical" || art === "gym" ? (
          <CinematicSpecialSet
            medical={art === "medical"}
            primary={primary}
            speaker={residentSpeaker}
          />
        ) : kind === "locker" ? (
          <LockerRoom primary={primary} secondary={secondary} speaker={residentSpeaker} />
        ) : null}
        {kind === "tunnel" ? (
          <Tunnel primary={primary} secondary={secondary} speaker={residentSpeaker} />
        ) : null}
        {kind === "press" ? (
          <PressRoom primary={primary} secondary={secondary} speaker={residentSpeaker} />
        ) : null}
        {kind === "pitch" ? (
          <PitchEntry
            primary={primary}
            secondary={secondary}
            speaker={residentSpeaker}
            festive={festive}
            training={art === "training"}
          />
        ) : null}
        {kind === "stands" ? <Stands primary={primary} secondary={secondary} /> : null}
        {kind === "office" ? (
          <Office primary={primary} secondary={secondary} speaker={residentSpeaker} />
        ) : null}
        {kind === "arrival" ? (
          <BusArrival primary={primary} secondary={secondary} speaker={residentSpeaker} />
        ) : null}
        {stagedActor?.presence === "overlay" ? (
          <Figure
            key={`speaker-${art}-${stagedActor.role}`}
            x={stagedActor.mark[0]}
            z={stagedActor.mark[1]}
            color={
              stagedActor.role === "captain" || stagedActor.role === "fan"
                ? primary
                : stagedActor.role === "referee"
                  ? "#222d36"
                  : secondary
            }
            shorts="#19232b"
            seed={hashSeed(`cinematic-speaker:${stagedActor.role}`)}
            role={stagedActor.role}
            costume={
              stagedActor.role === "captain" || stagedActor.role === "fan" ? "player" : "staff"
            }
            clipboard={
              stagedActor.role === "assistant" ||
              stagedActor.role === "doctor" ||
              stagedActor.role === "scout"
            }
            acting
          />
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
  onVisible,
  onReady,
  previewTime,
  cue,
  voiceClockRef,
  voicePlayingRef,
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
  onVisible?: (() => void) | undefined;
  onReady?: (() => void) | undefined;
  previewTime?: number | undefined;
  cue?: CinematicCue | undefined;
  voiceClockRef?: CinematicVoiceClockRef | undefined;
  voicePlayingRef?: { current: boolean } | undefined;
}) {
  const kind = cinematicSetFor(art);
  const webglAvailable = useMemo(() => supportsWebGL(), []);
  const initialQuality = useMemo(() => detectQuality(), []);
  const [quality, setQuality] = useState<QualityLevel>(() =>
    cinematicInitialQuality(initialQuality, qualityMode),
  );
  const previousQualityMode = useRef(qualityMode);
  const rendererName = useRef<string | undefined>(undefined);
  const contextListenerCleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (previousQualityMode.current === qualityMode) return;
    previousQualityMode.current = qualityMode;
    const next = cinematicInitialQuality(initialQuality, qualityMode);
    setQuality(
      qualityMode === "auto" && rendererName.current
        ? cinematicGpuQuality(next, rendererName.current)
        : next,
    );
  }, [qualityMode, initialQuality]);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const stageReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  const enhancedAllowed =
    ready && !paused && !reduced && !hidden && quality !== "baixa" && !contextLost;
  const showEnhanced = enhanced && enhancedAllowed;
  useEffect(() => {
    if (!enhancedAllowed) {
      setEnhanced(false);
      return;
    }
    const timer = window.setTimeout(() => startTransition(() => setEnhanced(true)), 200);
    return () => window.clearTimeout(timer);
  }, [enhancedAllowed]);
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
  useEffect(
    () => () => {
      contextListenerCleanup.current?.();
      contextListenerCleanup.current = null;
    },
    [],
  );
  const retryContext = useCallback(() => {
    setReady(false);
    setEnhanced(false);
    setContextLost(false);
    setCanvasGeneration((generation) => generation + 1);
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
          <Button
            type="button"
            variant="ghost"
            onClick={onUnavailable}
            className="absolute inset-0 z-10 h-auto rounded-none bg-background p-8 text-foreground"
          >
            A cena 3D não carregou. Abrir cena ilustrada.
          </Button>
        }
      >
        {webglAvailable && !contextLost ? (
          <Canvas
            key={canvasGeneration}
            frameloop={paused || reduced || hidden ? "demand" : "always"}
            shadows={initialQuality === "baixa" ? false : { type: THREE.PCFShadowMap }}
            dpr={dprFor(quality)}
            camera={{ position: [0, 2.2, 6.5], fov: 42, near: 0.05, far: 90 }}
            gl={{
              antialias: initialQuality !== "baixa",
              powerPreference: "high-performance",
              stencil: false,
            }}
            onCreated={({ gl }) => {
              contextListenerCleanup.current?.();
              const onContextLost = (event: Event) => {
                // Prevent the browser's default reload path, then let the
                // cutscene fall back to its already-mounted illustrated scene.
                event.preventDefault();
                contextListenerCleanup.current?.();
                contextListenerCleanup.current = null;
                setEnhanced(false);
                setReady(false);
                setContextLost(true);
                onUnavailable?.();
              };
              gl.domElement.addEventListener("webglcontextlost", onContextLost, false);
              contextListenerCleanup.current = () =>
                gl.domElement.removeEventListener("webglcontextlost", onContextLost, false);
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.shadowMap.type = THREE.PCFShadowMap;
              gl.info.autoReset = false;
              const context = gl.getContext();
              const debug = context.getExtension("WEBGL_debug_renderer_info");
              if (debug) {
                const renderer = String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL));
                rendererName.current = renderer;
                if (host.current) host.current.dataset["cinematicGpu"] = renderer;
                if (qualityMode === "auto") {
                  setQuality(cinematicGpuQuality(quality, renderer));
                }
              }
            }}
          >
            {qualityMode === "auto" && !paused && !reduced && !hidden ? (
              <PerformanceMonitor
                // Drei counts high and low samples as flips. A high-refresh scene
                // must never hit a generic fallback merely because it is healthy.
                // Limite de trocas evita oscilação de qualidade, que recompila
                // shaders e piscava a tela em preto/branco.
                flipflops={3}
                bounds={(refreshRate) => (refreshRate > 100 ? [60, 120] : [24, 45])}
                iterations={3}
                threshold={0.8}
                onIncline={() => setQuality((current) => cinematicAutoQualityOnIncline(current))}
                onDecline={() => setQuality((current) => cinematicAutoQualityOnDecline(current))}
                onFallback={({ fps }) =>
                  setQuality((current) => cinematicAutoQualityOnFallback(current, fps))
                }
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
              cue={cue}
              voiceClockRef={voiceClockRef}
              voicePlayingRef={voicePlayingRef}
            >
              <CinematicFrameProbe
                host={host}
                openedAt={openedAt.current}
                stopped={paused || reduced || hidden}
                onVisible={onVisible}
                onReady={stageReady}
              />
              <Stage
                kind={kind}
                art={art}
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
                enhanced={showEnhanced}
              />
              {showEnhanced ? (
                <Suspense fallback={null}>
                  <CinematicLens
                    quality={quality}
                    intensity={intensity}
                    climax={climax}
                    mood={mood}
                  />
                </Suspense>
              ) : null}
            </CinematicRuntime>
          </Canvas>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={contextLost ? retryContext : onUnavailable}
            className="absolute inset-0 z-10 h-auto rounded-none bg-background p-8 text-foreground"
          >
            {contextLost
              ? "A cena 3D perdeu o contexto. Tentar novamente."
              : "O 3D está indisponível neste navegador. Abrir cena ilustrada."}
          </Button>
        )}
      </GraphicsBoundary>
    </div>
  );
});
