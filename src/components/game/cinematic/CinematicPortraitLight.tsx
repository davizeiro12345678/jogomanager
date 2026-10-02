import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCinematicRuntime } from "./cinematic-runtime";

/** A soft camera-side bounce keeps reverse-shot faces readable, without shadows. */
export function CinematicPortraitLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const runtime = useCinematicRuntime();
  useFrame(({ camera }) => {
    if (!light.current) return;
    light.current.position.copy(camera.position);
    light.current.position.y += 1;
    target.position.copy(runtime.focus);
    light.current.intensity = camera.userData["cinematicFraming"] === "dialogue" ? 1.6 : 0.4;
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} target={target} color="#fff0e2" intensity={0.4} />
    </>
  );
}
