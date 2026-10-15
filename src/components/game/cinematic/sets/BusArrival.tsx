import { RoundedBox } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { CinematicActor as Figure } from "../CinematicActor";
import { useCinematicFrame, useCinematicRuntime } from "../cinematic-runtime";
import { cinematicSurface } from "../cinematic-surfaces";
import type { CinematicSetProps } from "./types";

export function BusArrival({ primary, secondary, speaker }: CinematicSetProps) {
  const beacon = useRef<THREE.PointLight>(null);
  const runtime = useCinematicRuntime();
  useCinematicFrame((time) => {
    if (beacon.current)
      beacon.current.intensity = runtime.reduced ? 1.1 : Math.sin(time * 6) > 0 ? 2.8 : 0.35;
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
