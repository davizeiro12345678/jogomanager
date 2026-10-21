import { useEffect, useMemo } from "react";

import { buildArenaArchitecture } from "@/components/game/stadium/arena-architecture-builder";

/** Circulation details and braced roof bays are baked once into three draws. */
export function ArenaArchitecture({
  rings,
  color,
  night,
}: {
  rings: number;
  color: string;
  night: boolean;
}) {
  const data = useMemo(() => buildArenaArchitecture(rings, color, night), [rings, color, night]);
  useEffect(
    () => () => {
      data.meshes.forEach((mesh) => mesh.geometry.dispose());
      data.materials.forEach((material) => material.dispose());
    },
    [data],
  );
  return (
    <group dispose={null}>
      {data.meshes.map((mesh, i) => (
        <mesh key={i} geometry={mesh.geometry} material={mesh.material} />
      ))}
    </group>
  );
}
