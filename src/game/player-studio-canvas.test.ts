import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, extend, flushSync } from "@react-three/fiber";
import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { createStudioAppearanceStore } from "./player-studio-appearance";
import { lookFor } from "./player-model";

it("commits a structural appearance edit to an existing Canvas root synchronously", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({ Group: THREE.Group });
  const canvas = {} as HTMLCanvasElement;
  const renderer = {
    render() {},
    setPixelRatio() {},
    setSize() {},
    domElement: canvas,
    shadowMap: {},
  } as unknown as THREE.WebGLRenderer;
  const root = createRoot(canvas);
  const appearance = createStudioAppearanceStore({
    ...lookFor("studio-canvas-sync", "MF", true),
    hairStyle: "medium",
  });
  function Preview() {
    const look = useSyncExternalStore(appearance.subscribe, appearance.getSnapshot);
    return createElement("group", { name: look.hairStyle });
  }
  try {
    await root.configure({
      gl: renderer,
      frameloop: "never",
      size: { width: 100, height: 100, top: 0, left: 0 },
    });
    let scene: THREE.Scene;
    await act(async () => {
      scene = root.render(createElement(Preview)).getState().scene;
    });
    expect(scene!.children[0]?.name).toBe("medium");
    const sceneIdentity = scene!;
    act(() => {
      flushSync(() => appearance.set({ ...appearance.getSnapshot(), hairStyle: "buzz" }));
      // Assert before act exits: no frame, timer or root recreation can supply the update.
      expect(sceneIdentity.children[0]?.name).toBe("buzz");
    });
    expect(appearance.diagnostics().subscribers).toBe(1);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
