import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { batchStaticStadium, type StaticStadiumBatch } from "@/game/static-stadium-batch";

/** Batch after React has mounted every static descendant. Animated actors,
 * FX, instances and skinned surfaces retain their original frame updates. */
export interface CinematicBatchSnapshot {
  sources: number;
  batches: number;
  visibleSources: number;
}

function hasSameScenery(root: THREE.Group, previous: ReadonlySet<THREE.Object3D>): boolean {
  let same = true;
  let count = 0;
  root.traverse((object) => {
    count++;
    if (!previous.has(object)) same = false;
  });
  return same && count === previous.size;
}

export function CinematicSetBatch({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady?: ((snapshot: CinematicBatchSnapshot) => void) | undefined;
}) {
  const group = useRef<THREE.Group>(null);
  const cleanup = useRef<StaticStadiumBatch | null>(null);
  const waitingForScenery = useRef<ReadonlySet<THREE.Object3D> | null>(null);
  const frames = useRef(0);
  const { invalidate } = useThree();

  useEffect(
    () => () => {
      cleanup.current?.();
      cleanup.current = null;
    },
    [],
  );

  useFrame(() => {
    if (!group.current) return;
    let prepared = false;
    if (!cleanup.current) {
      if (++frames.current < 3) {
        invalidate();
        return;
      }
      // A lazy set can still be suspended after the shell's first frames.
      // An empty batch must not permanently own scenery that arrives later,
      // nor repeatedly serialize unchanged source materials on every frame.
      if (waitingForScenery.current && hasSameScenery(group.current, waitingForScenery.current))
        return;
      const batch = batchStaticStadium(group.current);
      if (batch.batches === 0) {
        batch();
        const scenery = new Set<THREE.Object3D>();
        group.current.traverse((object) => scenery.add(object));
        waitingForScenery.current = scenery;
        return;
      }
      waitingForScenery.current = null;
      cleanup.current = batch;
      prepared = true;
      invalidate();
    }
    cleanup.current.hideSources();
    if (prepared || ++frames.current % 60 === 0) {
      const stats = group.current.userData["staticBatch"] as {
        sources: THREE.Mesh[];
        batches: number;
      };
      onReady?.({
        sources: stats.sources.length,
        batches: stats.batches,
        visibleSources: stats.sources.filter((mesh) => mesh.visible).length,
      });
    }
  }, -90);

  return <group ref={group}>{children}</group>;
}
