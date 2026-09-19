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
import { Canvas, useFrame } from "@react-three/fiber";
import { memo, useMemo, useRef } from "react";
import * as THREE from "three";

import type { SceneArt } from "@/content/cutscenes";

type SetKind = "locker" | "tunnel" | "press" | "pitch" | "stands" | "office";

const SET_BY_ART: Record<SceneArt, SetKind> = {
  arrival: "stands",
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
};

/** Enquadramentos por cena: a câmera corta para o próximo a cada fala. */
const SHOTS: Record<SetKind, Array<[number, number, number, number, number, number]>> = {
  //          posX   posY  posZ   alvoX alvoY alvoZ
  locker: [
    [0, 1.9, 5.6, 0, 1.2, -1.2],
    [-3.2, 1.35, 2.4, -0.6, 1.1, -2.4],
    [2.6, 2.4, 3.2, 0.4, 1.0, -2.0],
    [0.4, 1.05, 1.9, -0.4, 1.25, -2.8],
  ],
  tunnel: [
    [0, 1.7, 7.4, 0, 1.6, -8],
    [1.5, 1.2, 3.2, -0.6, 1.5, -6],
    [-1.6, 2.5, 1.2, 0.2, 1.3, -7],
    [0, 1.45, -1.5, 0, 1.7, -9.5],
  ],
  press: [
    [0, 1.75, 5.4, 0, 1.25, -2.2],
    [-2.8, 1.3, 2.6, 0.1, 1.3, -2.6],
    [2.4, 2.1, 2.2, -0.2, 1.2, -2.8],
    [0.2, 1.1, 1.6, 0, 1.3, -3],
  ],
  pitch: [
    [0, 2.4, 9.5, 0, 1.2, -1],
    [-6.5, 1.1, 4.5, 0, 1.3, -2],
    [5.5, 3.4, 5.5, -0.5, 1.0, -3],
    [0, 0.85, 3.2, 0, 1.5, -4],
  ],
  stands: [
    [0, 3.2, 11, 0, 3.4, -6],
    [-7, 2.1, 6, 1, 3.2, -7],
    [6.5, 4.6, 7, -1, 3.0, -7],
    [0, 1.6, 4.5, 0, 3.8, -8],
  ],
  office: [
    [0, 1.8, 5.2, 0, 1.15, -1.6],
    [-2.7, 1.45, 2.8, 0.3, 1.1, -2.2],
    [2.5, 2.0, 2.6, -0.3, 1.1, -2.2],
    [0.3, 1.2, 1.9, 0, 1.2, -2.6],
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
}: {
  x: number;
  z: number;
  rot?: number;
  color: string;
  shorts?: string;
  seed?: number;
  pose?: "stand" | "sit" | "walk";
  scale?: number;
}) {
  const rig = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const skin = SKIN[Math.floor(hash(seed) * SKIN.length)]!;
  const hair = HAIR[Math.floor(hash(seed + 7) * HAIR.length)]!;
  const off = hash(seed + 3) * 6.28;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + off;
    if (chest.current) chest.current.scale.y = 1 + Math.sin(t * 1.6) * 0.016;
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.5) * 0.2;
      head.current.rotation.x = Math.sin(t * 0.37) * 0.06;
    }
    const swing = pose === "walk" ? Math.sin(t * 3.2) * 0.5 : Math.sin(t * 0.9) * 0.07;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (rig.current && pose === "walk") rig.current.position.y = Math.abs(Math.sin(t * 3.2)) * 0.035;
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

/* ------------------------------------------------------------------ sets */

function LockerRoom({ primary, secondary }: { primary: string; secondary: string }) {
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
        <meshStandardMaterial color="#0d1712" emissive="#0d3a22" emissiveIntensity={0.4} roughness={0.5} />
      </mesh>
      {/* lâmpadas práticas */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 3.5, -1]}>
          <boxGeometry args={[2.6, 0.08, 0.3]} />
          <meshBasicMaterial color="#e9fff1" toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={lamp} position={[0, 3.3, -1]} intensity={9} distance={14} color="#dcffe9" castShadow />
      <Figure x={-1.9} z={0.6} rot={0.2} pose="sit" color={primary} seed={2} />
      <Figure x={-0.4} z={0.6} rot={-0.1} pose="sit" color={primary} seed={5} />
      <Figure x={1.4} z={0.6} rot={0.12} pose="sit" color={secondary} seed={9} />
      <Figure x={2.9} z={0.6} rot={-0.25} pose="sit" color={primary} seed={13} />
      <Figure x={0.2} z={-2.1} rot={3.1} color="#1d2b24" seed={21} />
    </group>
  );
}

function Tunnel({ primary, secondary }: { primary: string; secondary: string }) {
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
        />
      ))}
      {/* boca do túnel */}
      <mesh ref={glow} position={[0, 1.9, -12]}>
        <planeGeometry args={[6.6, 3.8]} />
        <meshBasicMaterial color="#e6fff0" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 2, -11]} intensity={26} distance={22} color="#eafff2" />
    </group>
  );
}

function PressRoom({ primary, secondary }: { primary: string; secondary: string }) {
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
      <Figure x={0} z={-1.95} color={secondary} shorts="#1a1f21" seed={31} />
      {/* fotógrafos e flashes */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Figure key={i} x={-3.4 + i * 1.7} z={2.4} rot={Math.PI} color="#20262b" seed={i * 17 + 2} />
      ))}
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

function Crowd({ rows = 8, cols = 40, y = 3, z = -14, tint }: { rows?: number; cols?: number; y?: number; z?: number; tint: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
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
    const m = new THREE.Matrix4();
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = -cols * 0.35 + col * 0.7 + (hash(i) - 0.5) * 0.18;
      const sway = Math.sin(t * 2 + col * 0.35 + row) * 0.05;
      m.makeTranslation(x, y + row * 0.62 + sway, z - row * 0.7);
      mesh.current.setMatrixAt(i, m);
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

function PitchEntry({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <group>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} receiveShadow rotation-x={-Math.PI / 2} position={[0, i % 2 ? 0.001 : 0, 8 - i * 2.2]}>
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
        <mesh position={[-3.66, 1.22, 0]}><cylinderGeometry args={[0.06, 0.06, 2.44, 8]} /><meshStandardMaterial color="#f3fff7" /></mesh>
        <mesh position={[3.66, 1.22, 0]}><cylinderGeometry args={[0.06, 0.06, 2.44, 8]} /><meshStandardMaterial color="#f3fff7" /></mesh>
        <mesh position={[0, 2.44, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.06, 0.06, 7.32, 8]} /><meshStandardMaterial color="#f3fff7" /></mesh>
      </group>
      <Crowd tint={primary} y={2.6} z={-22} rows={7} cols={44} />
      {/* refletores */}
      {[-14, 14].map((x) => (
        <group key={x} position={[x, 0, -18]}>
          <mesh position={[0, 5, 0]}><cylinderGeometry args={[0.12, 0.16, 10, 8]} /><meshStandardMaterial color="#2a3330" roughness={0.6} metalness={0.4} /></mesh>
          <mesh position={[0, 10, 0.4]}><boxGeometry args={[2.4, 0.9, 0.2]} /><meshBasicMaterial color="#f6fff9" toneMapped={false} /></mesh>
        </group>
      ))}
      {/* fila de entrada + bola */}
      {Array.from({ length: 11 }).map((_, i) => (
        <Figure key={i} x={-5.2 + i * 1.06} z={0.4 + (i % 2) * 0.5} pose="walk" color={i < 6 ? primary : secondary} seed={i * 9 + 1} />
      ))}
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
          <meshStandardMaterial color={i % 2 ? primary : secondary} roughness={0.8} side={THREE.DoubleSide} />
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

function Office({ primary, secondary }: { primary: string; secondary: string }) {
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
      <Figure x={-0.9} z={-2.3} rot={0.3} color={primary} shorts="#1b1f22" seed={41} />
      <Figure x={1.1} z={-2.3} rot={-0.25} color={secondary} shorts="#1b1f22" seed={57} />
    </group>
  );
}

/* ----------------------------------------------------------- direção 3D */

function Director({ kind, beat }: { kind: SetKind; beat: number }) {
  const shots = SHOTS[kind];
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const current = useRef(new THREE.Vector3());
  const currentLook = useRef(new THREE.Vector3());
  const started = useRef(false);

  useFrame(({ camera, clock }, delta) => {
    const shot = shots[beat % shots.length]!;
    const t = clock.elapsedTime;
    // travelling lento + micro tremor de câmera na mão
    target.set(
      shot[0] + Math.sin(t * 0.16) * 0.5 + Math.sin(t * 2.7) * 0.012,
      shot[1] + Math.sin(t * 0.21) * 0.11 + Math.sin(t * 3.1) * 0.008,
      shot[2] - t * 0 + Math.cos(t * 0.13) * 0.32,
    );
    look.set(shot[3], shot[4], shot[5]);
    if (!started.current) {
      current.current.copy(target);
      currentLook.current.copy(look);
      started.current = true;
    }
    const k = 1 - Math.pow(0.0015, delta);
    current.current.lerp(target, k);
    currentLook.current.lerp(look, k);
    camera.position.copy(current.current);
    camera.lookAt(currentLook.current);
  });
  return null;
}

function Stage({
  kind,
  beat,
  primary,
  secondary,
  mood,
}: {
  kind: SetKind;
  beat: number;
  primary: string;
  secondary: string;
  mood: "good" | "bad" | "neutral";
}) {
  const warm = mood === "good" ? "#fff3d6" : mood === "bad" ? "#cfe0ff" : "#effff4";
  const indoor = kind === "locker" || kind === "press" || kind === "office" || kind === "tunnel";
  return (
    <>
      <fog attach="fog" args={[indoor ? "#070c0a" : "#0a1310", indoor ? 8 : 22, indoor ? 34 : 70]} />
      <ambientLight intensity={indoor ? 0.34 : 0.55} color={warm} />
      <hemisphereLight intensity={0.35} color={warm} groundColor="#0a140f" />
      <directionalLight
        castShadow
        position={[5, 11, 6]}
        intensity={indoor ? 1.4 : 2.6}
        color={warm}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />
      {/* luz de recorte atrás dos personagens */}
      <spotLight position={[-5, 6, -5]} angle={0.7} penumbra={0.9} intensity={28} color={primary} />
      <Environment resolution={96} frames={1}>
        <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
        <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color={primary} />
        <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color={secondary} />
      </Environment>
      <Director kind={kind} beat={beat} />
      {kind === "locker" ? <LockerRoom primary={primary} secondary={secondary} /> : null}
      {kind === "tunnel" ? <Tunnel primary={primary} secondary={secondary} /> : null}
      {kind === "press" ? <PressRoom primary={primary} secondary={secondary} /> : null}
      {kind === "pitch" ? <PitchEntry primary={primary} secondary={secondary} /> : null}
      {kind === "stands" ? <Stands primary={primary} secondary={secondary} /> : null}
      {kind === "office" ? <Office primary={primary} secondary={secondary} /> : null}
    </>
  );
}

export const CinematicStage3D = memo(function CinematicStage3D({
  art,
  primary,
  secondary,
  beat = 0,
  mood = "neutral",
}: {
  art: SceneArt;
  primary: string;
  secondary: string;
  beat?: number;
  mood?: "good" | "bad" | "neutral";
}) {
  const kind = SET_BY_ART[art] ?? "locker";
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        shadows
        dpr={[0.8, 1.5]}
        camera={{ position: [0, 2.2, 6.5], fov: 42 }}
        gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Stage kind={kind} beat={beat} primary={primary} secondary={secondary} mood={mood} />
      </Canvas>
    </div>
  );
});
