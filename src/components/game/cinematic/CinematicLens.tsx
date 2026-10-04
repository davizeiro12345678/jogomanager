import {
  EffectComposer,
  Bloom,
  Vignette,
  N8AO,
  BrightnessContrast,
  HueSaturation,
  ChromaticAberration,
  DepthOfField,
  Noise,
} from "@react-three/postprocessing";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BlendFunction, DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import type { QualityLevel } from "@/game/device";
import { useCinematicRuntime } from "./cinematic-runtime";

/** Dialogue needs a crisp face: restrained grading and short-range contact AO.
 * The shallow focus and tiny film texture run only in the high adaptive tier. */
export default function CinematicLens({
  quality,
  intensity = 0,
  climax = false,
  mood = "neutral",
}: {
  quality: QualityLevel;
  intensity?: number;
  climax?: boolean;
  mood?: "good" | "bad" | "neutral";
}) {
  const runtime = useCinematicRuntime();
  const depth = useRef<DepthOfFieldEffect>(null);
  const aberration = useMemo(
    () => new THREE.Vector2(0.00045 + intensity * 0.00045, 0.00075 + intensity * 0.0005),
    [intensity],
  );
  useFrame(() => {
    if (depth.current?.target) depth.current.target.copy(runtime.focus);
  });
  if (quality === "baixa") return null;
  return (
    <EffectComposer
      key={`${quality}-${climax ? "climax" : "line"}`}
      enableNormalPass={false}
      multisampling={0}
      resolutionScale={quality === "alta" ? 0.85 : 0.7}
    >
      {quality === "alta" ? (
        <N8AO
          color="#172330"
          aoRadius={0.18}
          distanceFalloff={0.5}
          intensity={0.6}
          halfRes
          screenSpaceRadius={false}
        />
      ) : (
        <></>
      )}
      {quality === "alta" ? (
        <DepthOfField
          ref={depth}
          target={runtime.focus}
          worldFocusRange={climax ? 1.2 : 1.8}
          focalLength={climax ? 0.038 : 0.026}
          bokehScale={climax ? 0.82 : 0.54}
          resolutionScale={0.62}
        />
      ) : (
        <></>
      )}
      <Bloom
        intensity={0.11 + intensity * 0.045}
        luminanceThreshold={mood === "bad" ? 0.91 : 0.95}
        luminanceSmoothing={0.24}
        mipmapBlur
      />
      {quality === "alta" ? (
        <ChromaticAberration offset={aberration} radialModulation modulationOffset={0.38} />
      ) : (
        <></>
      )}
      <HueSaturation saturation={mood === "bad" ? -0.07 : -0.025} />
      <BrightnessContrast brightness={0.012} contrast={climax ? 0.07 : 0.045} />
      <Vignette offset={climax ? 0.18 : 0.22} darkness={climax ? 0.31 : 0.24} />
      {quality === "alta" ? (
        <Noise opacity={mood === "bad" ? 0.028 : 0.018} blendFunction={BlendFunction.OVERLAY} />
      ) : (
        <></>
      )}
    </EffectComposer>
  );
}
