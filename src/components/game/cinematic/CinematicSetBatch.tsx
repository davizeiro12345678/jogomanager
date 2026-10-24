import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useKtx2Revision } from "@/game/textures/ktx2";
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
  const textureRevision = useKtx2Revision();
  useLayoutEffect(
    () => {
      frames.current = 0;
      invalidate();
      return () => {
        cleanup.current?.();
        cleanup.current = null;
      };
    },
    // Source materials have received the decoded maps in this commit. Rebuild
    // the cloned batches without remounting animated actors or resetting clocks.
    [textureRevision, invalidate],
  );
  // React can reapply source visibility during a commit. Reconcile it here,
  // instead of walking every static mesh in every animation frame.
  useLayoutEffect(() => {
    cleanup.current?.hideSources();
  });
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
      invalidate();
    }
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
