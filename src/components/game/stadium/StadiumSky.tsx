import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { skyTexture } from "@/components/game/stadium/textures/sky";
import { matchLighting } from "@/game/match-lighting";
import { type TimeOfDay, type Weather } from "@/game/matchday";

export function SkyDome({ time, weather }: { time: TimeOfDay; weather: Weather }) {
  const tex = useMemo(() => skyTexture(time), [time]);
  const material = useMemo(() => {
    const surface = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    if (weather === "chuva" || weather === "neve") {
      // Keep the cached cloud detail but close the blue sky and the solar halo
      // under active precipitation. One existing sky draw, no extra overlay.
      const overcast = new THREE.Color(matchLighting(time, weather, false).sky);
      surface.customProgramCacheKey = () => "stadium-overcast-sky-v1";
      surface.onBeforeCompile = (shader) => {
        shader.uniforms["skyOvercastColor"] = { value: overcast };
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 skyOvercastColor;")
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            float skyLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(skyLuminance), skyOvercastColor, 0.58), 0.88);`,
          );
      };
    }
    return surface;
  }, [tex, time, weather]);
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.0035;
  });
  if (!tex) return null;
  return (
    <mesh ref={ref} scale={[-1, 1, 1]} userData={{ census: "sky" }}>
      <sphereGeometry args={[420, 48, 28]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
