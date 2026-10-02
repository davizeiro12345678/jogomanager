import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Speaker } from "@/content/cutscenes";
import { CinematicActor } from "./CinematicActor";
import { useCinematicFrame } from "./cinematic-runtime";

/** Training has moving drills, equipment and a coach instead of a static lineup. */
export function CinematicTraining({
  primary,
  secondary,
  speaker,
}: {
  primary: string;
  secondary: string;
  speaker: Speaker | null;
}) {
  const balls = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useCinematicFrame((time) => {
    if (!balls.current) return;
    for (let i = 0; i < 5; i++) {
      const phase = time * 0.45 + i * 1.3;
      dummy.position.set(
        -2.4 + i * 1.55 + Math.sin(phase) * 0.75 + Math.cos(phase) * 0.34,
        0.11,
        -1.2 + (i % 2) * 2.7 + Math.cos(phase) * 0.75 - Math.sin(phase) * 0.34,
      );
      dummy.rotation.set(time * 1.2, phase, 0);
      dummy.updateMatrix();
      balls.current.setMatrixAt(i, dummy.matrix);
    }
    balls.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <CinematicActor
        x={-5.2}
        z={0.4}
        color={secondary}
        shorts="#19232b"
        role="manager"
        seed={21}
        acting={speaker === "manager" || speaker === "assistant"}
        attention={[-1, -1]}
      />
      {Array.from({ length: 5 }, (_, i) => (
        <CinematicActor
          key={i}
          x={-2.4 + i * 1.55}
          z={-1.2 + (i % 2) * 2.7}
          color={primary}
          seed={i * 11 + 4}
          drillPhase={i * 1.3}
          pose="walk"
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} position={[-3.5 + (i % 6) * 1.65, 0, -2.6 + Math.floor(i / 6) * 5]}>
          <mesh position={[0, 0.13, 0]}>
            <coneGeometry args={[0.12, 0.26, 8]} />
            <meshStandardMaterial color="#fa8d30" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <boxGeometry args={[0.3, 0.024, 0.3]} />
            <meshStandardMaterial color="#fa8d30" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <instancedMesh ref={balls} args={[undefined, undefined, 5]} frustumCulled={false}>
        <sphereGeometry args={[0.11, 12, 8]} />
        <meshStandardMaterial color="#edf2e4" roughness={0.55} />
      </instancedMesh>
    </group>
  );
}
