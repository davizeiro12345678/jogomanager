import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import { censusRef } from "@/game/scene-census";
import { grassBladeGeometry } from "@/game/grass-blade";

const COLS = 6,
  ROWS = 4;
const WIDTH = (FIELD_X * 2 + 10) / COLS,
  DEPTH = (FIELD_Z * 2 + 10) / ROWS;
/** Bounded 24 chunks with real bounds. Far grass stays in the PBR surface. */
export function GrassChunks({
  material,
  density,
  pressure = 0,
  maxVisibleChunks = COLS * ROWS,
}: {
  material: THREE.Material;
  density: number;
  pressure?: number;
  maxVisibleChunks?: number;
}) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  // Lâminas só existem quando a câmera pode lê-las. O tapete PBR já cobre
  // planos abertos; desenhar milhares de cones ali criava pontos pretos e não
  // aumentava detalhe percebido.
  const count = Math.max(1, Math.round(210 * Math.max(0, density)));
  const geometry = useMemo(() => grassBladeGeometry(), []);
  const chunks = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => ({
        x: -FIELD_X - 5 + ((i % COLS) + 0.5) * WIDTH,
        z: -FIELD_Z - 5 + (Math.floor(i / COLS) + 0.5) * DEPTH,
      })),
    [],
  );
  useEffect(() => {
    const d = new THREE.Object3D();
    const color = new THREE.Color();
    let seed = 731;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296;
    };
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const chunk = chunks[index]!;
      for (let i = 0; i < count; i++) {
        d.position.set(
          chunk.x + (random() - 0.5) * WIDTH,
          0.01,
          chunk.z + (random() - 0.5) * DEPTH,
        );
        d.rotation.set(0, random() * Math.PI, 0);
        d.scale.setScalar(0.72 + random() * 0.48);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        color.setHSL(0.27 + random() * 0.035, 0.36, 0.5 + random() * 0.13);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [chunks, count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const elapsed = useRef(1);
  useFrame(({ camera }, dt) => {
    elapsed.current += dt;
    if (elapsed.current < 0.2) return;
    elapsed.current = 0;
    const candidates = chunks
      .map((chunk, index) => ({
        index,
        distance: Math.hypot(
          Math.max(0, Math.abs(camera.position.x - chunk.x) - WIDTH / 2),
          camera.position.y,
          Math.max(0, Math.abs(camera.position.z - chunk.z) - DEPTH / 2),
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
    const active = new Set(
      candidates.slice(0, Math.max(0, maxVisibleChunks)).map(({ index }) => index),
    );
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const chunk = chunks[index]!;
      const distance = Math.hypot(
        Math.max(0, Math.abs(camera.position.x - chunk.x) - WIDTH / 2),
        camera.position.y,
        Math.max(0, Math.abs(camera.position.z - chunk.z) - DEPTH / 2),
      );
      const previous = mesh.visible;
      const lowCamera = camera.position.y < 19;
      mesh.visible =
        active.has(index) && density > 0 && lowCamera && distance < (previous ? 32 : 27);
      mesh.count = distance < 14 ? count : Math.round(count * (pressure >= 2 ? 0.18 : 0.34));
    });
  });
  return (
    <group dispose={null} ref={censusRef("grass")}>
      {chunks.map((_, index) => (
        <instancedMesh
          key={index}
          ref={(mesh) => {
            refs.current[index] = mesh;
          }}
          args={[geometry, material, count]}
          visible={false}
        />
      ))}
    </group>
  );
}
