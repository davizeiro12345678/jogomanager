import { useFrame } from "@react-three/fiber";
import { useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  batchStaticStadium,
  createStaticStadiumObserver,
  type StaticStadiumBatch,
} from "@/game/static-stadium-batch";
import type { CensusBucket } from "@/game/scene-census";
import { StaticBatchOwner } from "./static-batch-context";
import { useKtx2Revision } from "@/game/textures/ktx2";

/** Wait for descendant geometry and observable state to settle after R3F
 * commits. A changed source revision first restores the source meshes, then
 * requires another stable window before a replacement batch can commit. */
export function StaticBatch({
  children,
  signature,
  enabled = true,
  bucket,
  shadows,
}: {
  children: ReactNode;
  signature?: string | number;
  enabled?: boolean;
  bucket?: CensusBucket;
  shadows?: boolean;
}) {
  const parentOwns = useContext(StaticBatchOwner);
  const active = enabled && !parentOwns;
  const textureRevision = useKtx2Revision();
  const root = useRef<THREE.Group>(null);
  const pending = useRef(true);
  const settled = useRef({ revision: "", frames: 0 });
  const dynamicSources = useRef(new Set<THREE.Mesh>());
  const cleanup = useRef<StaticStadiumBatch | null>(null);
  const observer = useRef<ReturnType<typeof createStaticStadiumObserver> | undefined>(undefined);

  useLayoutEffect(() => {
    pending.current = true;
    settled.current = { revision: "", frames: 0 };
    dynamicSources.current.clear();
    return () => {
      cleanup.current?.();
      cleanup.current = null;
      observer.current?.dispose();
      observer.current = undefined;
    };
  }, [signature, active, bucket, shadows, textureRevision]);

  useFrame(() => {
    const currentRoot = root.current;
    if (!currentRoot) return;
    if (!active) return;

    const currentBatch = cleanup.current;
    const observation = (observer.current ??= createStaticStadiumObserver(currentRoot));
    let state = observation.read({
      exclude: dynamicSources.current,
    });
    if (currentBatch && !currentBatch.isCurrent(state.revision)) {
      // Detect source churn before cleanup restores source visibility. The
      // changed source is then excluded from the replacement static batch.
      for (const mesh of currentBatch.changedSources()) dynamicSources.current.add(mesh);
      currentBatch();
      cleanup.current = null;
      pending.current = true;
      settled.current = { revision: "", frames: 0 };
      // Cleanup restored source visibility and changed the exclusion set.
      // Only this transition needs a fresh capture in the same frame.
      state = observation.read({ exclude: dynamicSources.current });
    }

    if (pending.current) {
      if (!state.sourceCount) return;
      const stable = settled.current;
      stable.frames = state.revision === stable.revision ? stable.frames + 1 : 0;
      stable.revision = state.revision;
      if (stable.frames >= 2) {
        const next = batchStaticStadium(currentRoot, {
          ...(bucket ? { bucket } : {}),
          ...(shadows === undefined ? {} : { shadows }),
          exclude: dynamicSources.current,
        });
        cleanup.current = next;
        pending.current = false;
      }
    }
    cleanup.current?.hideSources();
  }, -90);

  return (
    <StaticBatchOwner.Provider value={parentOwns || active}>
      <group ref={root}>{children}</group>
    </StaticBatchOwner.Provider>
  );
}
