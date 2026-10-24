import { expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { Box3, CylinderGeometry, Mesh } from "three";
import { World } from "@dimforge/rapier3d-compat";
import { Goal } from "./PitchGoals";
import { createRapierBallAuthority } from "@/game/rapier-ball-authority";
import { FIELD_X, GOAL_POST_RADIUS } from "@/game/sim-rules";
import type { SimView } from "@/game/sim-types";

// Evaluate the real JSX geometry without a WebGL renderer or running frame
// callbacks. Descendant components stay as elements in this shallow tree.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => undefined,
  useRef: (current: unknown) => ({ current }),
}));
vi.mock("@react-three/fiber", () => ({ useFrame: () => undefined }));
vi.mock("@/game/textures/ktx2", () => ({ ktx2: () => null, useKtx2Revision: () => 0 }));

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props["children"] as ReactNode)];
}

it("matches front goal mesh bounds to the authoritative contact frame on both ends", async () => {
  const physics = await createRapierBallAuthority();
  const snapshot = physics.checkpoint();
  const world = World.restoreSnapshot(snapshot.world);
  try {
    for (const side of [-1, 1]) {
      const tree = elements(Goal({ side, quality: "alta", sim: {} as SimView, wet: 0 }));
      const cylinders = tree.filter((element) => element.type === "cylinderGeometry");
      const meshes = tree.filter((element) => element.type === "mesh");
      // Two front posts and a crossbar retain their original 16 segments.
      const front = cylinders.filter((element) => (element.props["args"] as number[])[3] === 16);
      expect(front).toHaveLength(3);
      for (const cylinder of front) {
        const args = cylinder.props["args"] as [number, number, number, number];
        expect(args.slice(0, 2)).toEqual([GOAL_POST_RADIUS, GOAL_POST_RADIUS]);
        const parent = meshes.find((mesh) => mesh.props["children"] === cylinder)!;
        const geometry = new CylinderGeometry(...args);
        const mesh = new Mesh(geometry);
        mesh.position.fromArray(parent.props["position"] as number[]);
        mesh.position.x += side * FIELD_X;
        const rotation = parent.props["rotation"] as [number, number, number] | undefined;
        if (rotation) mesh.rotation.set(...rotation);
        mesh.updateMatrixWorld();
        const bounds = new Box3().setFromObject(mesh);
        let compared = false;
        world.forEachCollider((collider) => {
          const position = collider.translation();
          if (
            Math.abs(position.x - mesh.position.x) > 1e-4 ||
            Math.abs(position.y - mesh.position.y) > 1e-4 ||
            Math.abs(position.z - mesh.position.z) > 1e-4
          )
            return;
          const half = args[2] / 2;
          const crossbar = Boolean(rotation);
          expect(bounds.min.x).toBeCloseTo(position.x - GOAL_POST_RADIUS, 5);
          expect(bounds.max.x).toBeCloseTo(position.x + GOAL_POST_RADIUS, 5);
          expect(bounds.min.y).toBeCloseTo(position.y - (crossbar ? GOAL_POST_RADIUS : half), 5);
          expect(bounds.max.y).toBeCloseTo(position.y + (crossbar ? GOAL_POST_RADIUS : half), 5);
          expect(bounds.min.z).toBeCloseTo(position.z - (crossbar ? half : GOAL_POST_RADIUS), 5);
          expect(bounds.max.z).toBeCloseTo(position.z + (crossbar ? half : GOAL_POST_RADIUS), 5);
          if (crossbar) {
            const extents = collider.halfExtents();
            if (!extents) throw new Error("Crossbar must retain its canonical cuboid collider");
            expect(extents.x).toBeCloseTo(GOAL_POST_RADIUS, 5);
            expect(extents.y).toBeCloseTo(GOAL_POST_RADIUS, 5);
            expect(extents.z).toBeCloseTo(half, 5);
          } else {
            expect(collider.radius()).toBeCloseTo(GOAL_POST_RADIUS, 5);
            expect(collider.halfHeight()).toBeCloseTo(half, 5);
          }
          compared = true;
        });
        expect(compared).toBe(true);
        geometry.dispose();
      }
      // The thin rear supports are decorative and keep their existing sizes.
      expect(cylinders.filter((c) => (c.props["args"] as number[])[0] === 0.035)).toHaveLength(2);
      expect(cylinders.filter((c) => (c.props["args"] as number[])[0] === 0.04)).toHaveLength(1);
      const materials = new Set(meshes.map((mesh) => mesh.props["material"]));
      for (const material of materials)
        if (material && typeof material === "object" && "dispose" in material)
          (material as { dispose(): void }).dispose();
    }
  } finally {
    world.free();
    physics.dispose();
  }
});
