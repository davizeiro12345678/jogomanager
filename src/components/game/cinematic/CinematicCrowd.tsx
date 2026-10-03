import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic-runtime";

const randomAt = (index: number) => {
  const value = Math.sin(index * 127.1 + 3.4) * 43758.5453;
  return value - Math.floor(value);
};

/** Articulated crowd silhouettes use five draws, regardless of audience size. */
export function CinematicCrowd({
  rows = 8,
  cols = 40,
  y = 3,
  z = -14,
  tint,
  secondary = "#e8e4dc",
  festive = false,
}: {
  rows?: number;
  cols?: number;
  y?: number;
  z?: number;
  tint: string;
  secondary?: string;
  festive?: boolean;
}) {
  const runtime = useCinematicRuntime();
  const torso = useRef<THREE.InstancedMesh>(null),
    heads = useRef<THREE.InstancedMesh>(null);
  const hair = useRef<THREE.InstancedMesh>(null),
    arms = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const count = rows * cols;
  const initialized = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = useMemo(
    () => [tint, secondary, "#233646", "#b6bbc1", "#665b55"].map((c) => new THREE.Color(c)),
    [tint, secondary],
  );
  const materials = useMemo(
    () => ({
      torso: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      heads: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }),
      hair: new THREE.MeshStandardMaterial({ color: "#302621", roughness: 0.97 }),
      arms: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      legs: new THREE.MeshStandardMaterial({ color: "#23303b", roughness: 0.95 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  useCinematicFrame((time, dt) => {
    if (
      !torso.current ||
      !heads.current ||
      !arms.current ||
      !legs.current ||
      !hair.current ||
      (initialized.current && dt === 0)
    )
      return;
    const place = (
      mesh: THREE.InstancedMesh,
      index: number,
      x: number,
      py: number,
      pz: number,
      sx: number,
      sy: number,
      sz: number,
      rz = 0,
    ) => {
      dummy.position.set(x, py, pz);
      dummy.scale.set(sx, sy, sz);
      dummy.rotation.set(0, 0, rz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols),
        col = i % cols;
      const x = -(cols - 1) * 0.35 + col * 0.7 + (randomAt(i) - 0.5) * 0.12;
      const base = y + row * 0.62;
      const depth = z - row * 0.7;
      const sway = Math.sin(time * (festive ? 1.8 : 0.65) + i * 0.71) * (festive ? 0.045 : 0.012);
      const lift = festive
        ? 0.5 + Math.sin(time * 1.9 + i * 0.8) * 0.5
        : randomAt(i + 41) > 0.88
          ? 0.38 + Math.sin(time * 0.8 + i) * 0.18
          : 0;
      place(torso.current, i, x + sway, base, depth, 1, 1, 1, sway * 0.8);
      place(heads.current, i, x + sway, base + 0.32, depth, 1, 1, 1);
      place(hair.current, i, x + sway, base + 0.385, depth - 0.012, 1, 0.48, 1);
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        place(
          arms.current,
          i * 2 + side,
          x + sway + sign * (0.19 + lift * 0.07),
          base - 0.08 + lift * 0.24,
          depth + 0.015,
          1,
          1,
          1,
          sign * (0.12 + lift * 2.5),
        );
        place(legs.current, i * 2 + side, x + sign * 0.075, base - 0.31, depth + 0.08, 1, 1, 1);
      }
      if (!initialized.current) {
        const color = palette[Math.floor(randomAt(i + 13) * palette.length)]!;
        torso.current.setColorAt(i, color);
        arms.current.setColorAt(i * 2, color);
        arms.current.setColorAt(i * 2 + 1, color);
        heads.current.setColorAt(
          i,
          new THREE.Color(["#d8ab87", "#a8704f", "#76503b", "#e3c3a5"][i % 4]),
        );
      }
    }
    for (const mesh of [torso.current, heads.current, hair.current, arms.current, legs.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (!initialized.current && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    initialized.current = true;
  });
  const segments = runtime.quality === "alta" ? 8 : 5;
  return (
    <group>
      <instancedMesh ref={torso} args={[undefined, materials.torso, count]} frustumCulled={false}>
        <capsuleGeometry args={[0.115, 0.23, 2, segments]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, materials.heads, count]} frustumCulled={false}>
        <sphereGeometry args={[0.11, segments, 4]} />
      </instancedMesh>
      <instancedMesh ref={hair} args={[undefined, materials.hair, count]} frustumCulled={false}>
        <sphereGeometry args={[0.112, segments, 4]} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, materials.arms, count * 2]} frustumCulled={false}>
        <capsuleGeometry args={[0.037, 0.21, 2, segments]} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, materials.legs, count * 2]} frustumCulled={false}>
        <capsuleGeometry args={[0.042, 0.24, 2, segments]} />
      </instancedMesh>
    </group>
  );
}
