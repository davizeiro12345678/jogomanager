import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import { buildPuddleInstanceMatrices, PUDDLE_COUNT } from "@/game/puddle-instance-data";

/** The twelve coplanar, non-overlapping ellipses share their original physical
 * material and circle geometry. Instance transforms upload once on mount. */
export function Puddles({ wet }: { wet: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matrices = useMemo(() => buildPuddleInstanceMatrices(FIELD_X, FIELD_Z), []);
  const geometry = useMemo(() => new THREE.CircleGeometry(1, 20), []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#123b2a",
        roughness: 0.06,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        envMapIntensity: 1.6,
      }),
    [],
  );
  useLayoutEffect(() => {
    material.opacity = 0.12 + wet * 0.18;
  }, [material, wet]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    (mesh.instanceMatrix.array as Float32Array).set(matrices);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return () => mesh.dispose();
  }, [matrices]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, PUDDLE_COUNT]}
      renderOrder={3}
      dispose={null}
    />
  );
}
