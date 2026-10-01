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
export function CinematicSetBatch({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady?: ((snapshot: CinematicBatchSnapshot) => void) | undefined;
}) {
  const group = useRef<THREE.Group>(null);
  const cleanup = useRef<StaticStadiumBatch | null>(null);
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
      cleanup.current = batchStaticStadium(group.current);
      prepared = true;
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
