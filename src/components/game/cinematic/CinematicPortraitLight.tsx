import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCinematicRuntime } from "./cinematic-runtime";

/** Camera-relative three-quarter key; the set supplies fill and rim. Reuses
 * the existing unshadowed light, so every reverse shot keeps facial volume. */
export function CinematicPortraitLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const view = useMemo(() => new THREE.Vector3(), []);
  const runtime = useCinematicRuntime();
  const first = useRef(true);
  useFrame(({ camera }) => {
    if (!light.current) return;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    // Keep the key's three-quarter angle stable across wide, close and reverse
    // shots. A fixed offset from a distant camera became a flat frontal light.
    view.copy(camera.position).sub(runtime.focus);
    view.y = 0;
    if (view.lengthSq() < 0.001) view.set(0, 0, 1);
    view.normalize();
    light.current.position
      .copy(runtime.focus)
      .addScaledVector(view, 4.2)
      .addScaledVector(right, -3.1);
    light.current.position.y += 2.5;
    target.position.copy(runtime.focus);
    const exposure = camera.userData["cinematicFraming"] === "dialogue" ? 1.5 : 0.72;
    light.current.intensity =
      first.current || runtime.reduced
        ? exposure
        : THREE.MathUtils.damp(light.current.intensity, exposure, 6, runtime.clock.dt);
    first.current = false;
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} target={target} color="#fff2e7" intensity={0.4} />
    </>
  );
}
