/**
 * Render 3D ao vivo de cada pacote da loja.
 *
 * Um objeto simples por tipo de pacote (baú de moedas, prancheta, cone de
 * treino, paleta de cores e troféu) girando devagar. Tudo procedural: sem
 * arquivos externos, sem download e sem espera.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

import type { PackKind } from "@/game/store-catalog";

function Coins({ accent, accent2 }: { accent: string; accent2: string }) {
  return (
    <group>
      <mesh position={[0, -0.42, 0]} castShadow>
        <boxGeometry args={[1.7, 0.7, 1.1]} />
        <meshStandardMaterial color={accent2} roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[1.75, 0.12, 1.15]} />
        <meshStandardMaterial color={accent} roughness={0.3} metalness={0.9} />
      </mesh>
      {[
        [-0.35, 0.16, 0.12],
        [0.1, 0.2, -0.18],
        [0.42, 0.14, 0.22],
        [-0.05, 0.42, 0.05],
      ].map((p, i) => (
        <mesh
          key={i}
          position={p as [number, number, number]}
          rotation={[Math.PI / 2 + i * 0.25, i * 0.7, i * 0.3]}
        >
          <cylinderGeometry args={[0.28, 0.28, 0.07, 28]} />
          <meshStandardMaterial color={accent} roughness={0.18} metalness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Clipboard({ accent, accent2 }: { accent: string; accent2: string }) {
  return (
    <group rotation={[-0.35, 0, 0.1]}>
      <mesh castShadow>
        <boxGeometry args={[1.25, 1.7, 0.08]} />
        <meshStandardMaterial color={accent2} roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.05, 0.06]}>
        <boxGeometry args={[1.05, 1.4, 0.04]} />
        <meshStandardMaterial color="#f2f5f8" roughness={0.85} />
      </mesh>
      {[0.42, 0.24, 0.06, -0.12, -0.3].map((y, i) => (
        <mesh key={i} position={[-0.05, y, 0.09]}>
          <boxGeometry args={[0.72 - i * 0.08, 0.05, 0.01]} />
          <meshStandardMaterial color={accent} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0.08]}>
        <boxGeometry args={[0.5, 0.16, 0.12]} />
        <meshStandardMaterial color={accent} metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

function TrainingCone({ accent, accent2 }: { accent: string; accent2: string }) {
  return (
    <group>
      <mesh position={[0, -0.1, 0]} castShadow>
        <coneGeometry args={[0.62, 1.5, 32]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.85, 0]}>
        <boxGeometry args={[1.5, 0.1, 1.5]} />
        <meshStandardMaterial color={accent2} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.44, 0.5, 0.18, 32]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>
      <mesh position={[0.85, 0.35, 0.1]} rotation={[0, 0, -0.4]}>
        <capsuleGeometry args={[0.14, 0.22, 6, 16]} />
        <meshStandardMaterial color="#d8dee6" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Palette({ accent, accent2 }: { accent: string; accent2: string }) {
  const dots = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", accent, "#ffffff"];
  return (
    <group rotation={[-0.9, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.12, 40]} />
        <meshStandardMaterial color={accent2} roughness={0.6} />
      </mesh>
      {dots.map((c, i) => {
        const a = (i / dots.length) * Math.PI * 2;
        return (
          <mesh key={c + i} position={[Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55]}>
            <cylinderGeometry args={[0.19, 0.19, 0.1, 24]} />
            <meshStandardMaterial color={c} roughness={0.25} metalness={0.1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Trophy({ accent, accent2 }: { accent: string; accent2: string }) {
  return (
    <group position={[0, -0.2, 0]}>
      <mesh position={[0, -0.62, 0]} castShadow>
        <boxGeometry args={[0.95, 0.24, 0.95]} />
        <meshStandardMaterial color={accent2} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.36, 0]}>
        <cylinderGeometry args={[0.22, 0.34, 0.3, 28]} />
        <meshStandardMaterial color={accent} metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.55, 0.28, 0.68, 32]} />
        <meshStandardMaterial color={accent} metalness={1} roughness={0.18} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.66, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.22, 0.06, 12, 24, Math.PI]} />
          <meshStandardMaterial color={accent} metalness={1} roughness={0.24} />
        </mesh>
      ))}
    </group>
  );
}

function Spinner({ kind, accent, accent2 }: { kind: PackKind; accent: string; accent2: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.55;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.5}>
      <group ref={ref}>
        {kind === "coins" ? (
          <Coins accent={accent} accent2={accent2} />
        ) : kind === "scout" ? (
          <Clipboard accent={accent} accent2={accent2} />
        ) : kind === "training" ? (
          <TrainingCone accent={accent} accent2={accent2} />
        ) : kind === "cosmetic" ? (
          <Palette accent={accent} accent2={accent2} />
        ) : (
          <Trophy accent={accent} accent2={accent2} />
        )}
      </group>
    </Float>
  );
}

export function PackScene({
  kind,
  accent,
  accent2,
}: {
  kind: PackKind;
  accent: string;
  accent2: string;
}) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 1.1, 3.5], fov: 38 }}
      gl={{ antialias: true, powerPreference: "low-power", alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color={accent} />
      <Environment>
        <Lightformer intensity={2} position={[0, 4, 2]} scale={[8, 8, 1]} />
        <Lightformer
          intensity={1.1}
          color={accent}
          position={[-4, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[10, 2, 1]}
        />
      </Environment>
      <Spinner kind={kind} accent={accent} accent2={accent2} />
    </Canvas>
  );
}

export default PackScene;
