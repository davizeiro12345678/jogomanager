import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeRng } from "@/game/rng";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { useVisual } from "@/game/visual-settings";
import type { Quality } from "../Stadium3D";

type WeatherDrop = { x: number; y: number; z: number; s: number; p: number };

type RandomSource = () => number;

function spawnWeatherDrop(random: RandomSource): WeatherDrop {
  return {
    x: (random() * 2 - 1) * (FIELD_X + 26),
    y: random() * 34,
    z: (random() * 2 - 1) * (FIELD_Z + 24),
    s: 0.6 + random() * 0.9,
    p: random() * 6.28,
  };
}

function createWeatherDrops(count: number, seed: number | string): WeatherDrop[] {
  const random = makeRng(seed);
  return Array.from({ length: Math.max(0, Math.floor(count)) }, () => spawnWeatherDrop(random));
}

function respawnWeatherDrop(drop: WeatherDrop, random: RandomSource) {
  drop.y = 30 + random() * 6;
  drop.x = (random() * 2 - 1) * (FIELD_X + 26);
  drop.z = (random() * 2 - 1) * (FIELD_Z + 24);
}

export function Weather({
  weather,
  wind,
  quality,
  density = 1,
}: {
  weather: "seco" | "molhado" | "chuva" | "neve";
  wind: number;
  quality: Quality;
  density?: number;
}) {
  const rain = weather === "chuva";
  const snow = weather === "neve";
  const partScale = useVisual().particles;
  const count = Math.max(
    0,
    Math.round(
      (quality === "alta" ? (rain ? 2600 : 1500) : rain ? 1100 : 700) * partScale * density,
    ),
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visualSeed = `${weather}:${quality}:${count}`;
  const respawnRandom = useMemo(() => makeRng(`${visualSeed}:respawn`), [visualSeed]);
  const drops = useMemo(() => createWeatherDrops(count, visualSeed), [count, visualSeed]);

  useFrame((_, rawDt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const dt = Math.min(rawDt, 0.05);
    const fall = rain ? 34 : 2.4;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]!;
      d.y -= fall * dt * d.s;
      d.x += wind * dt * (rain ? 5 : 1.6);
      if (!rain) d.z += Math.sin(d.p + d.y * 0.4) * dt * 0.9;
      if (d.y < 0) respawnWeatherDrop(d, respawnRandom);
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(0, 0, rain ? wind * 0.28 : 0);
      dummy.scale.set(1, rain ? 1 : 0.5, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!rain && !snow) return null;

  return (
    <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, count]}>
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
