import { useRef } from "react";
import * as THREE from "three";
import { CinematicActor as Figure } from "../CinematicActor";
import { useCinematicFrame } from "../cinematic-runtime";
import { HangingShirt, TacticsBoard } from "../CinematicSetDetails";
import { cinematicSurface } from "../cinematic-surfaces";
import type { CinematicSetProps } from "./types";

export function LockerRoom({ primary, secondary, speaker }: CinematicSetProps) {
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
