import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

import type { SceneArt } from "@/content/cutscenes";

function Figure({ x, z, color }: { x: number; z: number; color: string }) {
  const rig = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!rig.current) return;
    rig.current.position.y = Math.sin(clock.elapsedTime * 1.7 + x) * 0.018;
    rig.current.rotation.y = Math.sin(clock.elapsedTime * 0.45 + z) * 0.08;
  });
  return (
    <group ref={rig} position={[x, 0, z]}>
      <mesh position={[0, 1.72, 0]} castShadow><sphereGeometry args={[0.17, 16, 12]} /><meshStandardMaterial color="#9f6b4d" roughness={0.72} /></mesh>
      <mesh position={[0, 1.25, 0]} castShadow><capsuleGeometry args={[0.22, 0.58, 6, 12]} /><meshStandardMaterial color={color} roughness={0.58} /></mesh>
      <mesh position={[-0.12, 0.54, 0]} castShadow><capsuleGeometry args={[0.075, 0.62, 5, 8]} /><meshStandardMaterial color="#1b2430" roughness={0.75} /></mesh>
      <mesh position={[0.12, 0.54, 0]} castShadow><capsuleGeometry args={[0.075, 0.62, 5, 8]} /><meshStandardMaterial color="#1b2430" roughness={0.75} /></mesh>
    </group>
  );
}

function LockerRoom({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.04, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[16, 10]} /><meshStandardMaterial color="#30363a" roughness={0.36} metalness={0.08} /></mesh>
      <mesh receiveShadow position={[0, 2.3, -4]}><boxGeometry args={[16, 4.6, 0.18]} /><meshStandardMaterial color="#18221d" roughness={0.88} /></mesh>
      {Array.from({ length: 7 }).map((_, index) => (
        <group key={index} position={[-5.4 + index * 1.8, 0, -3.52]}>
          <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[1.5, 0.4, 0.75]} /><meshStandardMaterial color="#4a3828" roughness={0.82} /></mesh>
          <mesh position={[0, 1.75, 0.08]} castShadow><boxGeometry args={[0.72, 1.02, 0.08]} /><meshStandardMaterial color={index % 2 ? secondary : primary} roughness={0.54} /></mesh>
        </group>
      ))}
      <Figure x={-1.2} z={-0.8} color={primary} /><Figure x={1.1} z={-1.1} color={secondary} />
    </group>
  );
}

function Tunnel({ primary }: { primary: string }) {
  return (
    <group>
      <mesh receiveShadow position={[0, 0, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[8, 22]} /><meshStandardMaterial color="#1a1d1c" roughness={0.28} metalness={0.16} /></mesh>
      <mesh receiveShadow position={[-3.9, 2.4, 0]}><boxGeometry args={[0.2, 4.8, 22]} /><meshStandardMaterial color="#101714" roughness={0.85} /></mesh>
      <mesh receiveShadow position={[3.9, 2.4, 0]}><boxGeometry args={[0.2, 4.8, 22]} /><meshStandardMaterial color="#101714" roughness={0.85} /></mesh>
      {Array.from({ length: 6 }).map((_, index) => <Figure key={index} x={-1.35 + (index % 2) * 2.7} z={-4 + Math.floor(index / 2) * 1.5} color={primary} />)}
      <mesh position={[0, 2.3, -10.5]}><planeGeometry args={[7.6, 4.5]} /><meshBasicMaterial color="#dfffe8" toneMapped={false} /></mesh>
    </group>
  );
}

function PressRoom({ primary }: { primary: string }) {
  return (
    <group>
      <mesh receiveShadow position={[0, 0, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[16, 10]} /><meshStandardMaterial color="#202625" roughness={0.48} /></mesh>
      <mesh position={[0, 2.5, -3.8]}><boxGeometry args={[14, 5, 0.2]} /><meshStandardMaterial color={primary} roughness={0.65} /></mesh>
      {Array.from({ length: 18 }).map((_, index) => (
        <mesh key={index} position={[-5.8 + (index % 6) * 2.3, 1.2 + Math.floor(index / 6) * 0.72, -3.64]}>
          <boxGeometry args={[0.9, 0.28, 0.03]} /><meshStandardMaterial color={index % 3 ? "#effff4" : "#122019"} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.78, -1.1]}><boxGeometry args={[4.8, 0.16, 1]} /><meshStandardMaterial color="#141817" roughness={0.35} metalness={0.2} /></mesh>
      <Figure x={0} z={-1.45} color={primary} />
    </group>
  );
}

function PitchEntry({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}><planeGeometry args={[34, 22]} /><meshStandardMaterial color="#168344" roughness={0.9} /></mesh>
      {Array.from({ length: 10 }).map((_, index) => <Figure key={index} x={-5.3 + index * 1.18} z={-0.4 + (index % 2) * 0.65} color={index < 5 ? primary : secondary} />)}
      <Float speed={1.3} rotationIntensity={0.08} floatIntensity={0.16}><mesh position={[0, 0.16, 1.8]} castShadow><sphereGeometry args={[0.16, 16, 12]} /><meshStandardMaterial color="#f4f6ef" roughness={0.48} /></mesh></Float>
    </group>
  );
}

function Stage({ art, primary, secondary }: { art: SceneArt; primary: string; secondary: string }) {
  const cameraRig = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.18) * 0.34;
    camera.position.y = 2.35 + Math.sin(t * 0.22) * 0.08;
    camera.lookAt(0, 1.05, art === "tunnel" ? -2.6 : -1.1);
  });
  const kind = art === "dressing" || art === "kitroom" ? "locker" : art === "tunnel" ? "tunnel" : art === "press" ? "press" : "pitch";
  return (
    <group ref={cameraRig}>
      <ambientLight intensity={0.42} />
      <directionalLight castShadow position={[4, 8, 5]} intensity={2.2} color="#effff4" shadow-mapSize={[1024, 1024]} />
      <spotLight castShadow position={[-4, 6, 2]} angle={0.48} penumbra={0.72} intensity={32} color={primary} />
      <Environment resolution={64} frames={1}><Lightformer position={[0, 5, 1]} scale={[8, 2, 1]} intensity={2.5} color="#effff4" /></Environment>
      {kind === "locker" ? <LockerRoom primary={primary} secondary={secondary} /> : null}
      {kind === "tunnel" ? <Tunnel primary={primary} /> : null}
      {kind === "press" ? <PressRoom primary={primary} /> : null}
      {kind === "pitch" ? <PitchEntry primary={primary} secondary={secondary} /> : null}
    </group>
  );
}

export function CinematicStage3D({ art, primary, secondary }: { art: SceneArt; primary: string; secondary: string }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas shadows dpr={[0.75, 1.25]} camera={{ position: [0, 2.4, 6.8], fov: 43 }} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}>
        <Stage art={art} primary={primary} secondary={secondary} />
      </Canvas>
    </div>
  );
}