import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import type { SimView } from "@/game/sim";
import { GoalNetSurface } from "@/game/goal-net-surface";

export function GoalNet({
  side,
  sim,
  material,
  quality,
}: {
  side: number;
  sim: SimView;
  material: THREE.Material;
  quality: "alta" | "media" | "baixa";
}) {
  const surface = useMemo(() => new GoalNetSurface(side, quality, sim), [side, quality, sim]);
  useEffect(() => () => surface.dispose(), [surface]);
  useFrame(({ clock }, dt) => surface.update(sim, dt, clock.elapsedTime));
  return <mesh geometry={surface.geometry} material={material} frustumCulled={false} />;
}
