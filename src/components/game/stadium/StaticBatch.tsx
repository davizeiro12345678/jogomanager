import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { batchStaticStadium, type StaticStadiumBatch } from "@/game/static-stadium-batch";

/** Build after R3F attaches descendants for the first frame. Rebuild only
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
  const cleanup = useRef<StaticStadiumBatch | null>(null);
  useLayoutEffect(() => {
    pending.current = true;
    return () => {
      cleanup.current?.();
      cleanup.current = null;
    };
  }, [signature]);
  useFrame(() => {
    if (pending.current && root.current) {
      cleanup.current = batchStaticStadium(root.current);
      pending.current = false;
    }
    cleanup.current?.hideSources();
  }, -90);
  return <group ref={root}>{children}</group>;
}
