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
  unmounts: [] as (() => void)[],
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (frame: () => void) => hooks.frames.push(frame),
  useThree: () => ({ invalidate: () => hooks.invalidations++ }),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => (() => void) | undefined) => {
      const cleanup = effect();
      if (cleanup) hooks.unmounts.push(cleanup);
    },
    useRef: <T>(value: T) => {
      const ref = actual.useRef(value);
      if (value === null) hooks.refs.push(ref);
      return ref;
    },
  };
});
import { CinematicSetBatch, type CinematicBatchSnapshot } from "./CinematicSetBatch";

afterEach(() => {
  for (const unmount of hooks.unmounts) unmount();
  hooks.unmounts.length = 0;
  (hooks.refs[1]?.current as StaticStadiumBatch | null)?.();
  hooks.frames.length = 0;
  hooks.refs.length = 0;
  hooks.invalidations = 0;
  vi.restoreAllMocks();
});

it.each(["empty", "unmergeable"] as const)(
  "keeps a %s stage usable and batches scenery that arrives later",
  async (initial) => {
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
    await vi.waitFor(() => expect(hooks.invalidations).toBeGreaterThan(0));
    hooks.refs[0]!.current = group;
    const frame = hooks.frames[0]!;

    expect(() => {
      for (let index = 0; index < 6; index++) frame();
    }).not.toThrow();
    expect(hooks.invalidations).toBeLessThanOrEqual(4);
    expect(batches).toHaveBeenCalledTimes(1);

    if (initial === "empty") scenery.add(first);
    const late = new THREE.Mesh(geometry, material);
    scenery.add(late);
    frame();
    frame();
    frame();

    expect(first.visible).toBe(false);
    expect(late.visible).toBe(false);
    expect(snapshots.at(-1)).toEqual({ sources: 2, batches: 1, visibleSources: 0 });
    expect(batches).toHaveBeenCalledTimes(2);
    if (initial === "unmergeable") expect(unmatched.visible).toBe(true);
  },
);

it("replaces a positive batch after nested late scenery settles, and removes departed geometry", async () => {
  const root = new THREE.Group();
  const branch = new THREE.Group();
  root.add(branch);
  const material = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BoxGeometry();
  const first = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material);
  branch.add(first, second);
  const batches = vi.spyOn(batching, "batchStaticStadium");
  const sourceDispose = vi.spyOn(geometry, "dispose");
  const snapshots: CinematicBatchSnapshot[] = [];
  renderToStaticMarkup(
    createElement(CinematicSetBatch, {
      children: createElement("group"),
      onReady: (snapshot) => snapshots.push(snapshot),
    }),
  );
  await vi.waitFor(() => expect(hooks.invalidations).toBeGreaterThan(0));
  hooks.refs[0]!.current = root;
  const frame = hooks.frames[0]!;
  for (let index = 0; index < 6; index++) frame();
  expect(first.visible).toBe(false);
  const late = new THREE.Mesh(geometry, material);
  branch.add(late);
  frame();
  expect(first.visible).toBe(true);
  expect(late.visible).toBe(true);
  const later = new THREE.Mesh(geometry, material);
  branch.add(later);
  frame();
  expect(batches).toHaveBeenCalledTimes(1);
  frame();
  frame();
  expect(snapshots.at(-1)).toEqual({ sources: 4, batches: 1, visibleSources: 0 });
  expect(batches).toHaveBeenCalledTimes(2);
  branch.remove(late);
  frame();
  frame();
  frame();
  expect(snapshots.at(-1)).toEqual({ sources: 3, batches: 1, visibleSources: 0 });
  expect(batches).toHaveBeenCalledTimes(3);
  for (let index = 0; index < 120; index++) frame();
  expect(batches).toHaveBeenCalledTimes(3);
  expect(sourceDispose).not.toHaveBeenCalled();
});

it("ignores dynamic actor churn and releases generated resources and hierarchy listeners on reopen", async () => {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BoxGeometry();
  const first = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material);
  const hidden = new THREE.Mesh(geometry, material);
  hidden.visible = false;
  const actor = new THREE.Group();
  actor.userData["cinematicDynamic"] = true;
  root.add(first, second, hidden, actor);
  const batches = vi.spyOn(batching, "batchStaticStadium");
  const addListener = vi.spyOn(root, "addEventListener");
  const removeListener = vi.spyOn(root, "removeEventListener");
  const sourceDispose = vi.spyOn(geometry, "dispose");
  for (let cycle = 0; cycle < 3; cycle++) {
    const priorInvalidations = hooks.invalidations;
    renderToStaticMarkup(createElement(CinematicSetBatch, { children: createElement("group") }));
    await vi.waitFor(() => expect(hooks.invalidations).toBeGreaterThan(priorInvalidations));
    hooks.refs.at(-3)!.current = root;
    const frame = hooks.frames.at(-1)!;
    for (let index = 0; index < 4; index++) frame();
    const generated = root.children.find(
      (child) => child.userData["staticBatchGenerated"] === true,
    )!;
    const mesh = generated.children[0] as THREE.Mesh;
    const disposeGeometry = vi.spyOn(mesh.geometry, "dispose");
    const disposeMaterial = vi.spyOn(mesh.material as THREE.Material, "dispose");
    const invalidations = hooks.invalidations;
    actor.add(new THREE.Group());
    actor.position.x++;
    for (let index = 0; index < 4; index++) frame();
    expect(hooks.invalidations).toBe(invalidations);
    expect(first.visible).toBe(false);
    expect(hidden.visible).toBe(false);
    hooks.unmounts.at(-1)!();
    expect(root.children).toEqual([first, second, hidden, actor]);
    expect(first.visible).toBe(true);
    expect(hidden.visible).toBe(false);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
  }
  expect(batches).toHaveBeenCalledTimes(3);
  expect(addListener).toHaveBeenCalledTimes(6);
  expect(removeListener).toHaveBeenCalledTimes(6);
  expect(sourceDispose).not.toHaveBeenCalled();
});
