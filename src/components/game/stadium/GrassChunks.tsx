import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim";
import { censusRef } from "@/game/scene-census";
import { grassBladeGeometry } from "@/game/grass-blade";
import { markNearestGrassChunks } from "@/game/grass-chunk-visibility";
import { buildGrassInstanceBuffers, type GrassInstanceBuffers } from "@/game/grass-instance-data";
import { acquirePresentationLanes } from "@/game/presentation-lanes";

const COLS = 6,
  ROWS = 4;
const WIDTH = (FIELD_X * 2 + 10) / COLS,
  DEPTH = (FIELD_Z * 2 + 10) / ROWS;
/** Bounded 24 chunks with real bounds. Far grass stays in the PBR surface. */
export function GrassChunks({
  material,
  density,
  capacityDensity = density,
  pressure = 0,
  maxVisibleChunks = COLS * ROWS,
}: {
  material: THREE.Material;
  density: number;
  /** Tier capacity stays fixed while adaptive pressure changes visible count. */
  capacityDensity?: number;
  pressure?: number;
  maxVisibleChunks?: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const meshRefs = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, index) => (mesh: THREE.InstancedMesh | null) => {
        const previous = refs.current[index];
        if (previous && previous !== mesh) previous.dispose();
        refs.current[index] = mesh;
      }),
    [],
  );
  // Lâminas só existem quando a câmera pode lê-las. O tapete PBR já cobre
  // planos abertos; desenhar milhares de cones ali criava pontos pretos e não
  // aumentava detalhe percebido.
  const count = Math.max(1, Math.round(420 * Math.min(2, Math.max(0, capacityDensity))));
  const visibleCount = Math.min(count, Math.max(0, Math.round(420 * density)));
  const geometry = useMemo(() => grassBladeGeometry(), []);
  const chunks = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => ({
        x: -FIELD_X - 5 + ((i % COLS) + 0.5) * WIDTH,
        z: -FIELD_Z - 5 + (Math.floor(i / COLS) + 0.5) * DEPTH,
      })),
    [],
  );
  const activeChunks = useMemo(() => new Uint8Array(chunks.length), [chunks]);
  const closestIndices = useMemo(() => new Int32Array(chunks.length), [chunks]);
  const closestDistances = useMemo(() => new Float64Array(chunks.length), [chunks]);
  const distancesByChunk = useMemo(() => new Float64Array(chunks.length), [chunks]);
  const generation = useRef(0);
  useEffect(() => {
    const id = ++generation.current;
    let disposed = false;
    const apply = (buffers: readonly GrassInstanceBuffers[]) => {
      if (disposed || generation.current !== id) return;
      refs.current.forEach((mesh, index) => {
        const source = buffers[index];
        if (!mesh || !source) return;
        const matrices = mesh.instanceMatrix.array as Float32Array;
        matrices.set(source.matrices);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor ??= new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        (mesh.instanceColor.array as Float32Array).set(source.colors);
        mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      });
      invalidate();
    };
    if (typeof Worker === "undefined") {
      apply(buildGrassInstanceBuffers(chunks, count, WIDTH, DEPTH, FIELD_X));
      return () => {
        disposed = true;
      };
    }
    const controller = new AbortController();
    let worker: Worker | null = null;
    let release: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timeout) clearTimeout(timeout);
      timeout = undefined;
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
      }
      worker?.terminate();
      worker = null;
      release?.();
      release = null;
    };
    void acquirePresentationLanes(1, controller.signal).then((lease) => {
      release = lease;
      if (disposed) {
        lease?.();
        return;
      }
      const fallback = () => {
        finish();
        apply(buildGrassInstanceBuffers(chunks, count, WIDTH, DEPTH, FIELD_X));
      };
      if (!lease) {
        fallback();
        return;
      }
      try {
        worker = new Worker(new URL("../../../game/grass-instances.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onerror = fallback;
        timeout = setTimeout(fallback, 5_000);
        worker.onmessage = ({
          data,
        }: MessageEvent<{ type?: string; id?: number; buffers?: GrassInstanceBuffers[] }>) => {
          if (data.type === "ready" && data.id === id && data.buffers) {
            apply(data.buffers);
            finish();
          }
        };
        worker.postMessage({
          type: "build",
          id,
          chunks,
          count,
          width: WIDTH,
          depth: DEPTH,
          fieldX: FIELD_X,
        });
      } catch {
        fallback();
      }
    });
    return () => {
      disposed = true;
      controller.abort();
      finish();
    };
  }, [chunks, count, invalidate]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const elapsed = useRef(1);
  useFrame(({ camera }, dt) => {
    elapsed.current += dt;
    if (elapsed.current < 0.2) return;
    elapsed.current = 0;
    markNearestGrassChunks(
      chunks,
      camera.position,
      WIDTH,
      DEPTH,
      maxVisibleChunks,
      activeChunks,
      closestIndices,
      closestDistances,
      distancesByChunk,
    );
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const distance = distancesByChunk[index]!;
      const previous = mesh.visible;
      const lowCamera = camera.position.y < 19;
      mesh.visible =
        activeChunks[index] === 1 && density > 0 && lowCamera && distance < (previous ? 32 : 27);
      mesh.count =
        distance < 14 ? visibleCount : Math.round(visibleCount * (pressure >= 2 ? 0.18 : 0.34));
    });
  });
  return (
    <group dispose={null} ref={censusRef("grass")}>
      {chunks.map((_, index) => (
        <instancedMesh
          key={index}
          ref={meshRefs[index]!}
          args={[geometry, material, count]}
          visible={false}
        />
      ))}
    </group>
  );
}
