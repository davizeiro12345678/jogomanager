import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useVisual } from "@/game/visual-settings";
import {
  buildWeatherLayout,
  loadWeatherLayout,
  MAX_WEATHER_INSTANCES,
  WEATHER_STRIDE,
} from "@/game/wasm/weather-layout";
import type { Quality } from "./shared";
import {
  WeatherInstanceTransforms,
  writeWeatherInstancePosition,
} from "@/game/weather-instance-transforms";

type WeatherProps = {
  weather: "seco" | "molhado" | "chuva" | "neve";
  wind: number;
  quality: Quality;
  density?: number;
  webgl2?: boolean;
};

export function Weather(props: WeatherProps) {
  return props.webgl2 === false ? <CompatibleWeather {...props} /> : <GpuWeather {...props} />;
}

// Native WebGPU cannot execute GLSL ShaderMaterial. Keep the established
// instanced material path there; the optimized shader owns WebGL2 weather.
function CompatibleWeather({ weather, wind, quality, density = 1 }: WeatherProps) {
  const rain = weather === "chuva";
  const scale = useVisual().particles;
  const requested = Math.round(
    (quality === "alta" ? (rain ? 2600 : 1500) : rain ? 1100 : 700) * scale * density,
  );
  const count = Number.isFinite(requested)
    ? Math.min(MAX_WEATHER_INSTANCES, Math.max(0, requested))
    : 0;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seed = useRef((Math.random() * 0xffffffff) >>> 0).current;
  const spawn = useMemo(() => buildWeatherLayout(count, seed), [count, seed]);
  const transforms = useMemo(() => new WeatherInstanceTransforms(), []);
  const clock = useRef(0);
  useFrame((_, rawDt) => {
    if (!mesh.current) return;
    clock.current += Math.min(Math.max(rawDt, 0), 0.05);
    const finiteWind = Number.isFinite(wind) ? wind : 0;
    const matrices = transforms.prepare(mesh.current, rain, finiteWind);
    for (let index = 0; index < count; index++) {
      const offset = index * WEATHER_STRIDE;
      const y =
        36 -
        ((36 - spawn[offset + 1]! + clock.current * (rain ? 34 : 2.4) * spawn[offset + 3]!) % 36);
      const rawX = spawn[offset]! + clock.current * finiteWind * (rain ? 5 : 1.6) + 78.5;
      const x = (((rawX % 157) + 157) % 157) - 78.5;
      const z =
        spawn[offset + 2]! + (rain ? 0 : Math.sin(spawn[offset + 4]! + clock.current * 0.7) * 0.8);
      writeWeatherInstancePosition(matrices, index, x, y, z);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return count ? (
    <instancedMesh ref={mesh} frustumCulled={false} args={[undefined, undefined, count]}>
      {rain ? <planeGeometry args={[0.03, 0.85]} /> : <circleGeometry args={[0.05, 5]} />}
      <meshBasicMaterial
        color={rain ? "#cfe6ff" : "#ffffff"}
        transparent
        opacity={rain ? 0.35 : 0.8}
        depthWrite={false}
      />
    </instancedMesh>
  ) : null;
}

const vertexShader = `
  attribute vec3 instanceSpawn;
  attribute float instanceSpeed;
  attribute float instancePhase;
  uniform float weatherTime;
  uniform float wind;
  uniform float rain;
  #include <fog_pars_vertex>
  void main() {
    float fall = mix(2.4, 34.0, rain);
    float y = 36.0 - mod(36.0 - instanceSpawn.y + weatherTime * fall * instanceSpeed, 36.0);
    float x = mod(instanceSpawn.x + weatherTime * wind * mix(1.6, 5.0, rain) + 78.5, 157.0) - 78.5;
    float z = instanceSpawn.z + (1.0 - rain) * sin(instancePhase + weatherTime * 0.7) * 0.8;
    float angle = rain * wind * 0.28;
    vec3 local = position;
    local.xy = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * local.xy;
    vec4 mvPosition = modelViewMatrix * vec4(local + vec3(x, y, z), 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = `
  uniform vec3 tint;
  uniform float opacity;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(tint, opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** Static f32 spawn attributes; every particle moves on the GPU. */
function GpuWeather({ weather, wind, quality, density = 1 }: WeatherProps) {
  const rain = weather === "chuva";
  const active = rain || weather === "neve";
  const partScale = useVisual().particles;
  const requested = Math.round(
    (quality === "alta" ? (rain ? 2600 : 1500) : rain ? 1100 : 700) * partScale * density,
  );
  const count =
    active && Number.isFinite(requested)
      ? Math.min(MAX_WEATHER_INSTANCES, Math.max(0, requested))
      : 0;
  const seed = useRef((Math.random() * 0xffffffff) >>> 0).current;
  const fallback = useMemo(() => buildWeatherLayout(count, seed), [count, seed]);
  const [loaded, setLoaded] = useState<{ count: number; values: Float32Array } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (count)
      void loadWeatherLayout(count, seed).then((values) => {
        if (!cancelled && values) setLoaded({ count, values });
      });
    return () => {
      cancelled = true;
    };
  }, [count, seed]);
  const values = loaded?.count === count ? loaded.values : fallback;
  const geometry = useMemo(() => {
    const template = rain ? new THREE.PlaneGeometry(0.03, 0.85) : new THREE.CircleGeometry(0.05, 5);
    const result = new THREE.InstancedBufferGeometry();
    result.index = template.index;
    result.attributes = template.attributes;
    result.instanceCount = count;
    const buffer = new THREE.InstancedInterleavedBuffer(values, WEATHER_STRIDE);
    buffer.setUsage(THREE.StaticDrawUsage);
    result.setAttribute("instanceSpawn", new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    result.setAttribute("instanceSpeed", new THREE.InterleavedBufferAttribute(buffer, 1, 3));
    result.setAttribute("instancePhase", new THREE.InterleavedBufferAttribute(buffer, 1, 4));
    return result;
  }, [count, rain, values]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib["fog"]!),
          weatherTime: { value: 0 },
          wind: { value: 0 },
          rain: { value: rain ? 1 : 0 },
          tint: { value: new THREE.Color(rain ? "#cfe6ff" : "#ffffff") },
          opacity: { value: rain ? 0.35 : 0.8 },
        },
        vertexShader,
        fragmentShader,
        fog: true,
        transparent: true,
        depthWrite: false,
      }),
    [rain],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, rawDt) => {
    // One uniform update; no per-particle JS work or instanceMatrix uploads.
    material.uniforms["weatherTime"]!.value += Math.min(Math.max(rawDt, 0), 0.05);
    material.uniforms["wind"]!.value = Number.isFinite(wind) ? wind : 0;
  });
  return count ? (
    <mesh geometry={geometry} material={material} frustumCulled={false} dispose={null} />
  ) : null;
}
