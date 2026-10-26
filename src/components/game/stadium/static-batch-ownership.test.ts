import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import * as THREE from "three";
import * as batching from "@/game/static-stadium-batch";

const hooks = vi.hoisted(() => ({
  frames: [] as (() => void)[],
  refs: [] as { current: unknown }[],
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: (frame: () => void) => hooks.frames.push(frame),
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
import { StaticBatch } from "./StaticBatch";

afterEach(() => {
  for (let index = 1; index < hooks.refs.length; index += 2)
    (hooks.refs[index]?.current as (() => void) | null)?.();
  hooks.frames.length = 0;
  hooks.refs.length = 0;
  vi.restoreAllMocks();
});
it.each([true, false])(
  "assigns one owner per source hierarchy when the outer batch is %s",
  (enabled) => {
    const root = new THREE.Group(),
      left = new THREE.Group(),
      right = new THREE.Group();
    root.add(left, right);
    for (const branch of [left, right])
      for (let i = 0; i < 2; i++)
        branch.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    const spy = vi.spyOn(batching, "batchStaticStadium");
    renderToStaticMarkup(
      createElement(StaticBatch, {
        enabled,
        children: [
          createElement(StaticBatch, { key: "left", children: createElement("group") }),
          createElement(StaticBatch, { key: "right", children: createElement("group") }),
        ],
      }),
    );
    for (const [index, group] of [root, left, right].entries())
      hooks.refs[index * 2]!.current = group;
    for (let frame = 0; frame < 4; frame++) for (const callback of hooks.frames) callback();
    expect(spy).toHaveBeenCalledTimes(enabled ? 1 : 2);
  },
);
