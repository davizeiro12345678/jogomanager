import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVisual } from "@/game/visual-settings";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import type { Quality } from "../Stadium3D";
import {
  initializeWeatherInstanceMatrices,
  writeWeatherInstancePosition,
} from "@/game/weather-instance-data";
import {
  createStadiumCosmeticRng,
  createWeatherDrops,
  DEFAULT_STADIUM_FIXTURE,
  poolVisibleCount,
  WEATHER_POOL_CAPACITY,
  type WeatherDrop,
} from "./stadium-cosmetics";

function spawnDrop(drop: WeatherDrop, fixtureKey: string) {
  const rand = createStadiumCosmeticRng(fixtureKey, "weather-drop", drop.index, drop.cycle);
  drop.x = (rand() * 2 - 1) * (FIELD_X + 26);
  drop.y = 30 + rand() * 4;
  drop.z = (rand() * 2 - 1) * (FIELD_Z + 24);
}

export function Weather({
  weather,
  wind,
  quality,
  density = 1,
  fixtureKey = DEFAULT_STADIUM_FIXTURE,
}: {
  weather: "seco" | "molhado" | "chuva" | "neve";
  wind: number;
  quality: Quality;
  density?: number;
  fixtureKey?: string;
}) {
  const rain = weather === "chuva";
  const snow = weather === "neve";
  const partScale = useVisual().particles;
  const count = poolVisibleCount(
    Math.round(
      (quality === "alta" ? (rain ? 2600 : 1500) : rain ? 1100 : 700) * partScale * density,
    ),
    WEATHER_POOL_CAPACITY,
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => createWeatherDrops(fixtureKey), [fixtureKey]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    initializeWeatherInstanceMatrices(mesh.instanceMatrix.array as Float32Array, rain, wind);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
  }, [rain, snow, wind]);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const fall = rain ? 34 : 2.4;
    const matrices = mesh.instanceMatrix.array as Float32Array;
    mesh.count = count;
    for (let i = 0; i < count; i++) {
      const d = drops[i]!;
      d.y -= fall * dt * d.s;
      d.x += wind * dt * (rain ? 5 : 1.6);
      if (!rain) d.z += Math.sin(d.p + d.y * 0.4) * dt * 0.9;
      if (d.y < 0) {
        d.cycle += 1;
        spawnDrop(d, fixtureKey);
      }
      writeWeatherInstancePosition(matrices, i, d.x, d.y, d.z);
    }
    if (count > 0) {
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  if (!rain && !snow) return null;

  return (
    <instancedMesh
      ref={ref}
      frustumCulled={false}
      args={[undefined, undefined, WEATHER_POOL_CAPACITY]}
    >
      {rain ? <planeGeometry args={[0.03, 0.85]} /> : <circleGeometry args={[0.05, 5]} />}
      <meshBasicMaterial
        color={rain ? "#cfe6ff" : "#ffffff"}
        transparent
        opacity={rain ? 0.35 : 0.8}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * Marcação do campo pintada: um plano com a textura de cal por cima do
 * gramado. Substitui as antigas linhas de 1 pixel, que serrilhavam e
 * pareciam desenho técnico.
 */
/** Rede em losango, com nós — usada como alphaMap (recorte real, não plano leitoso). */
