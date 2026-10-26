import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";

/** A one-draw, four-instance bowl while the detailed stadium chunk loads.
 * Unmounts with Suspense: no extra geometry remains in the finished scene. */
export function StadiumShell({ rings }: { rings: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const height = 2 + rings * 1.45;
  const depth = 7 + rings * 1.5;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const put = (index: number, x: number, z: number, width: number, length: number) => {
      dummy.position.set(x, height / 2, z);
      dummy.scale.set(width, height, length);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };
    for (const [index, side] of [-1, 1].entries()) {
      put(index, 0, side * (FIELD_Z + 6 + depth / 2), FIELD_X * 2 + 18 + depth * 2, depth);
      put(index + 2, side * (FIELD_X + 9 + depth / 2), 0, depth, FIELD_Z * 2 + 12);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [height, depth, dummy]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 4]} name="stadium-loading-shell">
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial color="#37434b" />
    </instancedMesh>
  );
}
