import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import type { SimView } from "@/game/sim-types";

const CORNERS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** Four animated corners share two draws and one set of GPU resources. */
export function CornerFlags({ sim, webgl2 }: { sim: SimView; webgl2: boolean }) {
  const poles = useRef<THREE.InstancedMesh>(null);
  const flags = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const time = { value: 0 };
    const amplitude = { value: 0.16 };
    const material = new THREE.MeshStandardMaterial({
      color: "#f5c400",
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    if (webgl2) {
      material.customProgramCacheKey = () => "instanced-corner-cloth-v1";
      material.onBeforeCompile = (shader) => {
        shader.uniforms["flagTime"] = time;
        shader.uniforms["flagAmplitude"] = amplitude;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nuniform float flagTime; uniform float flagAmplitude;",
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            vec4 flagOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float flagPhase = (flagOrigin.x + flagOrigin.z) * 0.5;
            transformed.z += sin(flagTime * 6.0 + flagPhase + position.x * 8.0) * flagAmplitude * (position.x + 0.275);`,
          );
      };
    }
    return {
      time,
      amplitude,
      material,
      dummy: new THREE.Object3D(),
      matrix: new THREE.Matrix4(),
      pole: new THREE.Matrix4().makeTranslation(0, 0.75, 0),
      flag: new THREE.Matrix4().makeTranslation(0.28, 1.32, 0),
    };
  }, [webgl2]);
  useEffect(() => () => data.material.dispose(), [data]);
  useFrame(({ clock }) => {
    if (!poles.current || !flags.current) return;
    data.time.value = clock.elapsedTime;
    const wind = sim.wind?.strength01 ?? 0.25;
    data.amplitude.value =
      (0.015 + wind * 0.2) *
      (0.75 + 0.25 * Math.sin(clock.elapsedTime * 0.9) + 0.12 * Math.sin(clock.elapsedTime * 2.7));
    const yaw = Math.atan2(-(sim.wind?.z ?? 0.55), sim.wind?.x ?? 0.83);
    CORNERS.forEach(([sx, sz], i) => {
      data.dummy.position.set(sx * FIELD_X, 0, sz * FIELD_Z);
      data.dummy.rotation.set(0, yaw, Math.sin(clock.elapsedTime * 2.4 + i) * wind * 0.035);
      data.dummy.updateMatrix();
      poles.current!.setMatrixAt(i, data.matrix.multiplyMatrices(data.dummy.matrix, data.pole));
      flags.current!.setMatrixAt(i, data.matrix.multiplyMatrices(data.dummy.matrix, data.flag));
    });
    poles.current.instanceMatrix.needsUpdate = true;
    flags.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group name="pitch-corners">
      <instancedMesh ref={poles} args={[undefined, undefined, 4]} frustumCulled={false}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 6]} />
        <meshStandardMaterial color="#f5f5f5" />
      </instancedMesh>
      <instancedMesh
        ref={flags}
        args={[undefined, undefined, 4]}
        material={data.material}
        frustumCulled={false}
      >
        <planeGeometry args={[0.55, 0.35, 8, 3]} />
      </instancedMesh>
    </group>
  );
}
