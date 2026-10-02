import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { batchStaticStadium, type StaticStadiumBatch } from "@/game/static-stadium-batch";

/** Wait for descendant geometry to settle after R3F commits. Rebuild only
 * when the explicit signature changes; source meshes stay recoverable. */
export function StaticBatch({
  children,
  signature,
}: {
  children: ReactNode;
  signature?: string | number;
}) {
  const root = useRef<THREE.Group>(null);
  const pending = useRef(true);
  const settled = useRef({ signature: "", frames: 0 });
  const cleanup = useRef<StaticStadiumBatch | null>(null);
  useLayoutEffect(() => {
    pending.current = true;
    settled.current = { signature: "", frames: 0 };
    return () => {
      cleanup.current?.();
      cleanup.current = null;
    };
  }, [signature]);
  useFrame(() => {
    if (pending.current && root.current) {
      // Descendants may attach from layout effects after the parent mounts.
      // Batching an empty first frame permanently missed those stadium props.
      const sources: string[] = [];
      root.current.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry?.getAttribute("position"))
          sources.push(`${mesh.uuid}:${mesh.geometry.uuid}`);
      });
      const sourceSignature = sources.join("|");
      const state = settled.current;
      state.frames = sourceSignature === state.signature ? state.frames + 1 : 0;
      state.signature = sourceSignature;
      if (sources.length && state.frames >= 2) {
        cleanup.current = batchStaticStadium(root.current);
        pending.current = false;
      }
    }
    cleanup.current?.hideSources();
  }, -90);
  return <group ref={root}>{children}</group>;
}
