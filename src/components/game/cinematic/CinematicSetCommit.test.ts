import { expect, it, vi } from "vitest";
import { createElement, lazy } from "react";
import { act, createRoot, extend } from "@react-three/fiber";
import { Group, PerspectiveCamera, PointLight, Scene, type Camera, type Object3D } from "three";
import { promoteScenePrograms } from "@/game/graphics-warmup";
import { CinematicSetBoundary } from "./CinematicSetCommit";

it.each(["ordinary", "medical", "gym"] as const)(
  "keeps %s scenery visible and waits for the lazy set light before actor compilation",
  async (art) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    extend({ Group, PointLight });
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    const actor = new Group();
    actor.visible = false;
    const lightCounts: number[] = [];
    const renderer = {
      domElement: new EventTarget(),
      render() {},
      setPixelRatio() {},
      setSize() {},
      async compileAsync(_object: Object3D, _camera: Camera, target?: Scene) {
        let lights = 0;
        target!.traverse((object) => {
          if (object instanceof PointLight) lights++;
        });
        lightCounts.push(lights);
      },
    };
    const root = createRoot(new EventTarget());
    let resolveSet!: (module: { default: () => ReturnType<typeof createElement> }) => void;
    const SelectedSet = lazy(
      () =>
        new Promise<{ default: () => ReturnType<typeof createElement> }>((resolve) => {
          resolveSet = resolve;
        }),
    );
    const committed = () => {
      void promoteScenePrograms(renderer, actor, camera, new AbortController().signal, scene);
    };
    const content = createElement(
      "group",
      null,
      createElement("group", { name: "visible-shell" }),
      createElement(CinematicSetBoundary, {
        onCommitted: committed,
        scenery:
          art === "ordinary"
            ? null
            : createElement(
                "group",
                { name: `${art}-scenery` },
                createElement("pointLight", { name: "special-light" }),
              ),
        children: createElement(SelectedSet),
      }),
    );
    try {
      await act(async () => {
        await root.configure({ gl: renderer, scene, camera, frameloop: "never" });
        root.render(content);
      });
      expect(scene.getObjectByName("visible-shell")?.visible).toBe(true);
      if (art !== "ordinary") expect(scene.getObjectByName(`${art}-scenery`)?.visible).toBe(true);
      expect(actor.visible).toBe(false);
      expect(lightCounts).toEqual([]);

      await act(async () => {
        resolveSet({ default: () => createElement("pointLight", { name: "set-light" }) });
      });
      expect(scene.getObjectByName("set-light")).toBeInstanceOf(PointLight);
      expect(lightCounts).toEqual(art === "ordinary" ? [1] : [2]);
      expect(actor.visible).toBe(true);

      await act(async () => {
        root.render(content);
      });
      expect(lightCounts).toEqual(art === "ordinary" ? [1] : [2]);
    } finally {
      await act(async () => root.unmount());
      vi.unstubAllGlobals();
    }
  },
);
