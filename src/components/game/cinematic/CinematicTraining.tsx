import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Speaker } from "@/content/cutscenes";
import { CinematicActor } from "./CinematicActor";
import { useCinematicFrame } from "./cinematic-runtime";
import { useCinematicRuntime } from "./cinematic-runtime";
import { cinematicDrillAt, cinematicDrillFor } from "@/game/cinematic-action";

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
  const runtime = useCinematicRuntime();
  const balls = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useCinematicFrame((time) => {
    if (!balls.current) return;
    for (let i = 0; i < 5; i++) {
      const drill = cinematicDrillAt(time, i, cinematicDrillFor(runtime.cue?.id.split(":")[0]));
      dummy.position.set(drill.ballX, drill.ballY, drill.ballZ);
      dummy.rotation.set(time * 1.2, drill.yaw, 0);
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
        role="assistant"
        seed={21}
        acting={speaker === "assistant"}
        attention={[-1, -1]}
        clipboard
      />
      <CinematicActor
        x={-4.7}
        z={-1.8}
        color="#283d46"
        shorts="#19232b"
        role="manager"
        seed={31}
        acting={speaker === "manager"}
        attention={[-1, -1]}
      />
      {Array.from({ length: 5 }, (_, i) => (
        <CinematicActor
          key={i}
          x={-2.4 + i * 1.55}
          z={-1.2 + (i % 2) * 2.7}
          color={primary}
          seed={i * 11 + 4}
          drillIndex={i}
          role={i === 0 ? "captain" : undefined}
          acting={i === 0 && speaker === "captain"}
          attention={[-4.7, -1.8]}
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
