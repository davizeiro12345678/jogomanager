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
  const runtime = useCinematicRuntime();
  useFrame(({ camera }) => {
    if (!light.current) return;
    light.current.position.copy(camera.position);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    light.current.position.addScaledVector(right, -2.4);
    light.current.position.y += 1.7;
    target.position.copy(runtime.focus);
    light.current.intensity = camera.userData["cinematicFraming"] === "dialogue" ? 1.85 : 0.72;
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} target={target} color="#fff0e2" intensity={0.4} />
    </>
  );
}
