import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import { mergeRigParts, rigPart, type RigPart } from "@/game/rig-geometry";

/** Treads, slim rails, fascia and roof ribs are baked once into three
 * material groups. Stadium detail never adds a component per animation frame. */
export function ArenaArchitecture({
  rings,
  color,
  night,
}: {
  rings: number;
  color: string;
  night: boolean;
}) {
  const data = useMemo(() => {
    const concrete = new THREE.MeshStandardMaterial({ color: "#77827a", roughness: 0.95 });
    const metal = new THREE.MeshStandardMaterial({
      color: "#abb3b8",
      roughness: 0.55,
      metalness: 0.4,
    });
    const accent = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      emissive: color,
      emissiveIntensity: night ? 0.3 : 0.03,
    });
    const parts: RigPart[] = [];
    const box = (
      size: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
      rotation?: [number, number, number],
    ) =>
      parts.push(
        rigPart(new THREE.BoxGeometry(...size), material, {
          position,
          ...(rotation ? { rotation } : {}),
        }),
      );
    for (const side of [-1, 1]) {
      for (const lane of [-36, 0, 36])
        for (let row = 0; row < rings; row++) {
          const y = 2 + row * 1.45,
            z = side * (FIELD_Z + 7 + row * 1.5);
          box([1.45, 0.035, 1.46], [lane, y + 0.025, z], concrete);
          box([1.45, 0.14, 0.16], [lane, y - 0.02, z - side * 0.62], accent);
          for (const edge of [-1, 1])
            box([0.055, 0.9, 0.055], [lane + edge * 0.77, y + 0.44, z], metal);
          if (row < rings - 1)
            box([0.055, 0.055, 2.1], [lane + 0.77, y + 1.15, z + side * 0.75], metal, [
              -side * 0.768,
              0,
              0,
            ]);
        }
      for (const lane of [-24, 24])
        for (let row = 0; row < rings; row++) {
          const y = 2 + row * 1.45,
            x = side * (FIELD_X + 10 + row * 1.5);
          box([1.46, 0.035, 1.45], [x, y + 0.025, lane], concrete);
          box([0.16, 0.14, 1.45], [x - side * 0.62, y - 0.02, lane], accent);
          box([0.055, 0.9, 0.055], [x, y + 0.44, lane + 0.77], metal);
        }
      const roofY = 2 + rings * 1.45 + 7;
      const outer = 9 + rings * 1.5;
      // The roof edge has a recognisable continuous club-coloured fascia.
      box([FIELD_X * 2 + 36, 0.36, 0.22], [0, roofY - 0.32, side * (FIELD_Z + outer - 2)], accent);
      box([0.22, 0.36, FIELD_Z * 2 + 40], [side * (FIELD_X + outer - 2), roofY - 0.32, 0], accent);
      for (let i = -5; i <= 5; i++)
        box([0.09, 0.12, 11.2], [i * 12, roofY - 0.48, side * (FIELD_Z + outer + 4)], metal);
    }
    return { meshes: mergeRigParts(parts), materials: [concrete, metal, accent] };
  }, [rings, color, night]);
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
