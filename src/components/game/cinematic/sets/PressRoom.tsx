import { useEffect, useMemo } from "react";
import { CinematicActor as Figure } from "../CinematicActor";
import {
  cinematicBackdrop,
  cinematicSurface,
  releaseCinematicBackdrop,
} from "../cinematic-surfaces";
import { PressFlashes } from "./shared";
import type { CinematicSetProps } from "./types";

export function PressRoom({ primary, secondary, speaker }: CinematicSetProps) {
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
      <mesh position={[0, 2.4, -4]} receiveShadow>
        <boxGeometry args={[13, 4.8, 0.2]} />
        <meshStandardMaterial color="#21303b" roughness={0.72} />
      </mesh>
      <mesh position={[0, 2.45, -3.88]}>
        <planeGeometry args={[12.6, 4.25]} />
        <meshStandardMaterial map={backdrop} roughness={0.78} />
      </mesh>
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
