import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import type { StaticStadiumBatch } from "@/game/static-stadium-batch";
import * as batching from "@/game/static-stadium-batch";

const hooks = vi.hoisted(() => ({
  frames: [] as (() => void)[],
  refs: [] as { current: unknown }[],
  invalidations: 0,
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (frame: () => void) => hooks.frames.push(frame),
  useThree: () => ({ invalidate: () => hooks.invalidations++ }),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useRef: <T>(value: T) => {
      const ref = actual.useRef(value);
      if (value === null) hooks.refs.push(ref);
      return ref;
    },
  };
});
import { CinematicSetBatch, type CinematicBatchSnapshot } from "./CinematicSetBatch";

afterEach(() => {
  (hooks.refs[1]?.current as StaticStadiumBatch | null)?.();
  hooks.frames.length = 0;
  hooks.refs.length = 0;
  hooks.invalidations = 0;
  vi.restoreAllMocks();
});

it.each(["empty", "unmergeable"] as const)(
  "keeps a %s stage usable and batches scenery that arrives later",
  (initial) => {
    const group = new THREE.Group();
    const scenery = new THREE.Group();
    group.add(scenery);
    const material = new THREE.MeshStandardMaterial({ color: "blue" });
    const geometry = new THREE.BoxGeometry();
    const first = new THREE.Mesh(geometry, material);
    const unmatched = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: "red", roughness: 0.2 }),
    );
    if (initial === "unmergeable") scenery.add(first, unmatched);
    const snapshots: CinematicBatchSnapshot[] = [];
    const batches = vi.spyOn(batching, "batchStaticStadium");
    renderToStaticMarkup(
      createElement(CinematicSetBatch, {
        children: createElement("group"),
        onReady: (snapshot) => snapshots.push(snapshot),
      }),
    );
    hooks.refs[0]!.current = group;
    const frame = hooks.frames[0]!;

    expect(() => {
      for (let index = 0; index < 6; index++) frame();
    }).not.toThrow();
    expect(hooks.invalidations).toBeLessThanOrEqual(3);
    expect(batches).toHaveBeenCalledTimes(1);

    if (initial === "empty") scenery.add(first);
    const late = new THREE.Mesh(geometry, material);
    scenery.add(late);
    frame();

    expect(first.visible).toBe(false);
    expect(late.visible).toBe(false);
    expect(snapshots.at(-1)).toEqual({ sources: 2, batches: 1, visibleSources: 0 });
    expect(batches).toHaveBeenCalledTimes(2);
    if (initial === "unmergeable") expect(unmatched.visible).toBe(true);
  },
);
