import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type * as THREE from "three";
import { batchRigidActors, type RigidActorBatch as Batch } from "@/game/rigid-actor-batch";

/** Actor callbacks run at -20; copy their updated joints at -10, before render. */
export function RigidActorBatch({
  children,
  signature,
}: {
  children: ReactNode;
  signature: string;
}) {
  const root = useRef<THREE.Group>(null);
  const batch = useRef<Batch | null>(null);
  useLayoutEffect(
    () => () => {
      batch.current?.dispose();
      batch.current = null;
    },
    [signature],
  );
  useFrame(() => {
    if (!root.current) return;
    if (!batch.current) batch.current = batchRigidActors(root.current);
    else batch.current.sync();
  }, -10);
  return <group ref={root}>{children}</group>;
}
