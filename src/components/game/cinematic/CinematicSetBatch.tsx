import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  batchStaticStadium,
  createStaticStadiumObserver,
  type StaticStadiumBatch,
} from "@/game/static-stadium-batch";

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
  const observer = useRef<ReturnType<typeof createStaticStadiumObserver> | undefined>(undefined);
  const settled = useRef({ revision: -1, frames: 0 });
  const batchedRevision = useRef(-1);
  const frames = useRef(0);
  const { invalidate } = useThree();

  useEffect(
    () => () => {
      cleanup.current?.();
      cleanup.current = null;
      observer.current?.dispose();
      observer.current = undefined;
      settled.current = { revision: -1, frames: 0 };
      batchedRevision.current = -1;
      frames.current = 0;
    },
    [],
  );

  useFrame(() => {
    if (!group.current) return;
    const observation = (observer.current ??= createStaticStadiumObserver(
      group.current,
      invalidate,
    ));
    const revision = observation.hierarchyRevision;
    const stable = settled.current;
    if (stable.revision !== revision) {
      cleanup.current?.();
      cleanup.current = null;
      stable.revision = revision;
      stable.frames = 0;
    } else stable.frames++;
    let prepared = false;
    ++frames.current;
    if (batchedRevision.current !== revision) {
      if (frames.current < 3 || stable.frames < 2) {
        invalidate();
        return;
      }
      // Hierarchy events admit nested lazy descendants after either a positive
      // or empty result. Generated batches and dynamic actors never restart this.
      const batch = batchStaticStadium(group.current);
      batchedRevision.current = revision;
      if (batch.batches === 0) {
        batch();
        return;
      }
      cleanup.current = batch;
      prepared = true;
      invalidate();
    }
    if (!cleanup.current) return;
    cleanup.current.hideSources();
    if (prepared || frames.current % 60 === 0) {
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
