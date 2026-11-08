import { useFrame } from "@react-three/fiber";
import { useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  batchStaticStadium,
  staticStadiumMeshSignature,
  type StaticStadiumBatch,
} from "@/game/static-stadium-batch";
import type { CensusBucket } from "@/game/scene-census";
import { StaticBatchOwner } from "./static-batch-context";
import { useKtx2Revision } from "@/game/textures/ktx2";

/** Wait for descendant geometry to settle after R3F commits. Rebuild only
 * when the explicit signature changes; source meshes stay recoverable. */
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
  const settled = useRef({ signature: "", frames: 0 });
  const settledSources = useRef(new Map<THREE.Mesh, string>());
  const dynamicSources = useRef(new Set<THREE.Mesh>());
  const cleanup = useRef<StaticStadiumBatch | null>(null);
  useLayoutEffect(() => {
    pending.current = true;
    settled.current = { signature: "", frames: 0 };
    settledSources.current.clear();
    dynamicSources.current.clear();
    return () => {
      cleanup.current?.();
      cleanup.current = null;
    };
  }, [signature, active, bucket, shadows, textureRevision]);
  useFrame(() => {
    if (!active) return;
    const currentRoot = root.current;
    if (!currentRoot) return;
    const changedSources = cleanup.current?.changedSources() ?? [];
    if (changedSources.length) {
      changedSources.forEach((mesh) => dynamicSources.current.add(mesh));
      cleanup.current?.();
      cleanup.current = null;
      pending.current = true;
      settled.current = { signature: "", frames: 0 };
      settledSources.current.clear();
    }
    if (pending.current) {
      // Descendants may attach from layout effects after the parent mounts.
      // Batching an empty first frame permanently missed those stadium props.
      currentRoot.updateWorldMatrix(true, true);
      const sources: string[] = [];
      const meshes: THREE.Mesh[] = [];
      currentRoot.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (
          mesh.isMesh &&
          mesh.geometry?.getAttribute("position") &&
          !(mesh as THREE.InstancedMesh).isInstancedMesh &&
          !(mesh as THREE.SkinnedMesh).isSkinnedMesh &&
          !Array.isArray(mesh.material) &&
          mesh.userData["cinematicDynamic"] !== true &&
          mesh.userData["staticBatchDynamic"] !== true
        ) {
          meshes.push(mesh);
          sources.push(`${mesh.uuid}:${mesh.geometry.uuid}`);
        }
      });
      const currentSources = new Map(
        meshes.map((mesh) => [mesh, staticStadiumMeshSignature(mesh)]),
      );
      for (const mesh of meshes) {
        const previous = settledSources.current.get(mesh);
        if (previous !== undefined && previous !== currentSources.get(mesh))
          dynamicSources.current.add(mesh);
      }
      settledSources.current = currentSources;
      const sourceSignature = sources.join("|");
      const state = settled.current;
      state.frames = sourceSignature === state.signature ? state.frames + 1 : 0;
      state.signature = sourceSignature;
      if (sources.length && state.frames >= 2) {
        cleanup.current = batchStaticStadium(currentRoot, {
          ...(bucket ? { bucket } : {}),
          ...(shadows === undefined ? {} : { shadows }),
          exclude: dynamicSources.current,
        });
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
