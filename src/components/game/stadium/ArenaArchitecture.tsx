import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import { mergeRigParts, rigPart, type RigPart } from "@/game/rig-geometry";

/** Public builder makes the same three-material geometry budget testable. */
export function buildArenaArchitecture(rings: number, color: string, night: boolean) {
  rings = THREE.MathUtils.clamp(Math.round(rings), 4, 16);
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
        // Supports every two rows retain the continuous handrails while
        // freeing the fixed triangle budget for the goal-end and portals.
        if (row % 2 === 0 || row === rings - 1)
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
        if (row % 2 === 0 || row === rings - 1)
          box([0.055, 0.9, 0.055], [x, y + 0.44, lane + 0.77], metal);
      }
    const roofY = 2 + rings * 1.45 + 7;
    const outer = 9 + rings * 1.5;
    // The roof edge has a recognisable continuous club-coloured fascia.
    box([FIELD_X * 2 + 36, 0.36, 0.22], [0, roofY - 0.32, side * (FIELD_Z + outer - 2)], accent);
    box([0.22, 0.36, FIELD_Z * 2 + 40], [side * (FIELD_X + outer - 2), roofY - 0.32, 0], accent);
    for (let i = -5; i <= 5; i++)
      box([0.09, 0.12, 11.2], [i * 12, roofY - 0.48, side * (FIELD_Z + outer + 4)], metal);
    // Braced roof bays have depth when viewed from the pitch. All braces
    // remain in the existing metal batch; they need no lights or textures.
    for (let i = -5; i < 5; i++) {
      const center = i * 12 + 6;
      for (const diagonal of [-1, 1])
        box([0.075, 0.075, 16.4], [center, roofY - 0.6, side * (FIELD_Z + outer + 4)], metal, [
          0,
          diagonal * 0.82,
          0,
        ]);
      box([11.9, 0.09, 0.09], [center, roofY - 0.65, side * (FIELD_Z + outer - 1)], metal);
    }
    // Inner guardrails, fascia and circulation portals give the concrete
    // bowl a readable scale while keeping every stair tread unobstructed.
    const concourseY = 2 + Math.floor(rings * 0.52) * 1.45;
    const concourseZ = side * (FIELD_Z + 7 + Math.floor(rings * 0.52) * 1.5);
    for (const lane of [-36, 0, 36]) {
      for (const edge of [-1, 1])
        box([0.13, 2.3, 0.22], [lane + edge * 0.92, concourseY + 1.15, concourseZ], metal);
      box([1.96, 0.18, 0.28], [lane, concourseY + 2.32, concourseZ], accent);
    }
    for (const span of [-1, 1]) {
      box(
        [FIELD_X - 2, 0.085, 0.085],
        [span * (FIELD_X / 2 + 1), 2.92, side * (FIELD_Z + 6.3)],
        metal,
      );
      box(
        [FIELD_X - 2, 0.14, 0.18],
        [span * (FIELD_X / 2 + 1), 2.03, side * (FIELD_Z + 6.3)],
        accent,
      );
      for (let post = 0; post < 11; post++)
        box([0.06, 0.85, 0.06], [span * (2 + post * 4.7), 2.47, side * (FIELD_Z + 6.3)], metal);
    }
    // Goal-end seating gets the same protective rails as the long stands.
    const endX = side * (FIELD_X + 8.8);
    for (const span of [-1, 1]) {
      box([0.085, 0.085, FIELD_Z - 3], [endX, 2.92, span * (FIELD_Z / 2 + 2)], metal);
      box([0.18, 0.18, FIELD_Z - 3], [endX, 2.03, span * (FIELD_Z / 2 + 2)], accent);
      for (let post = 0; post < 8; post++)
        box([0.055, 0.85, 0.055], [endX, 2.47, span * (3 + post * 4.3)], metal);
    }
    // A continuous service fascia and soffit add depth beneath the roof.
    box([FIELD_X * 2 + 30, 0.16, 1.7], [0, roofY - 0.8, side * (FIELD_Z + outer - 1)], concrete);
    box([FIELD_X * 2 + 30, 0.07, 0.09], [0, roofY - 0.94, side * (FIELD_Z + outer - 1.8)], accent);
    // Braced entrance portals, with recessed lintels and club-colour edges.
    for (const lane of [-48, -12, 12, 48]) {
      const z = side * (FIELD_Z + 7.1);
      for (const edge of [-1, 1]) {
        box([0.32, 2.6, 1.4], [lane + edge * 1.15, 3.15, z], concrete);
        box([0.06, 2.35, 0.06], [lane + edge * 0.95, 3.1, z - side * 0.75], accent);
      }
      box([2.62, 0.32, 1.4], [lane, 4.48, z], concrete);
      box([2.05, 0.11, 0.08], [lane, 4.26, z - side * 0.75], accent);
    }
  }
  const meshes = mergeRigParts(parts);
  // mergeRigParts clones its inputs. Release the construction geometry too.
  parts.forEach((part) => part.geometry.dispose());
  return { meshes, materials: [concrete, metal, accent] };
}

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
