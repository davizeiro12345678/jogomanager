import { useEffect, useMemo } from "react";
import type { Speaker } from "@/content/cutscenes";
import { buildLockerFrame } from "@/game/locker-room-geometry";

import { CinematicActor as Figure } from "../CinematicActor";
import { HangingShirt, TacticsBoard } from "../CinematicSetDetails";

import { cinematicSurface } from "../cinematic-surfaces";

/* ------------------------------------------------------------------ sets */

export function LockerRoom({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const lockerFrame = useMemo(buildLockerFrame, []);
  useEffect(() => () => lockerFrame.dispose(), [lockerFrame]);
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial
          color="#79878b"
          map={cinematicSurface("tile")}
          normalMap={cinematicSurface("tile", "normal")}
          normalScale={[0.13, 0.13]}
          roughnessMap={cinematicSurface("tile", "roughness")}
          roughness={0.86}
          metalness={0}
        />
      </mesh>
      {/* paredes */}
      <mesh receiveShadow position={[0, 2.4, -4.4]}>
        <boxGeometry args={[18, 4.8, 0.2]} />
        <meshStandardMaterial
          color="#172c39"
          map={cinematicSurface("wall")}
          normalMap={cinematicSurface("wall", "normal")}
          normalScale={[0.08, 0.08]}
          roughnessMap={cinematicSurface("wall", "roughness")}
          roughness={0.96}
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
          <mesh geometry={lockerFrame} position={[0, 1.3, 0]} receiveShadow castShadow>
            <meshStandardMaterial
              color="#a9906a"
              map={cinematicSurface("wood")}
              normalMap={cinematicSurface("wood", "normal")}
              normalScale={[0.11, 0.11]}
              roughnessMap={cinematicSurface("wood", "roughness")}
              roughness={0.76}
            />
          </mesh>
          <mesh position={[0, 0.42, 0.34]} castShadow>
            <boxGeometry args={[1.42, 0.12, 0.62]} />
            <meshStandardMaterial color="#6e4b32" roughness={0.84} />
          </mesh>
          <group position={[0, 0, -0.22]}>
            <HangingShirt color={i % 2 ? secondary : primary} number={i + 5} />
          </group>
          <mesh position={[0.64, 2.1, 0.33]}>
            <boxGeometry args={[0.035, 0.3, 0.04]} />
            <meshStandardMaterial color="#8b9299" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {/* banco central e quadro tático */}
      <mesh position={[0, 0.44, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[6.4, 0.16, 0.72]} />
        <meshStandardMaterial
          color="#a48b68"
          map={cinematicSurface("wood")}
          normalMap={cinematicSurface("wood", "normal")}
          normalScale={[0.12, 0.12]}
          roughnessMap={cinematicSurface("wood", "roughness")}
          roughness={0.8}
        />
      </mesh>
      <TacticsBoard />
      {/* lâmpadas práticas */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, 3.5, -1]}>
          <boxGeometry args={[2.6, 0.08, 0.3]} />
          <meshBasicMaterial color="#fff0d8" toneMapped={false} />
        </mesh>
      ))}
      <pointLight position={[0, 3.3, -1]} intensity={10.5} distance={14} color="#ffe8ca" />
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
