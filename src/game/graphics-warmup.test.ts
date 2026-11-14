import { describe, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera, Scene, type Camera, type Object3D } from "three";
import {
  invalidateScenePrograms,
  prepareScenePrograms,
  promoteScenePrograms,
} from "./graphics-warmup";

function fixture() {
  const object = new Group();
  const camera = new PerspectiveCamera();
  const scene = new Scene();
  const compilations: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const renderer = {
    compileAsync(subject: Object3D, view: Camera, target?: Scene) {
      expect(subject).toBe(object);
      expect(view).toBe(camera);
      expect(target).toBe(scene);
      return new Promise<void>((resolve, reject) => compilations.push({ resolve, reject }));
    },
  };
  const prepare = (signal = new AbortController().signal) =>
    prepareScenePrograms(renderer, object, camera, signal, scene);
  return { renderer, object, camera, scene, compilations, prepare };
}

describe("scene program preparation", () => {
  it("does not submit compilation after cancellation before the scheduled work", async () => {
    const { prepare, compilations } = fixture();
    const controller = new AbortController();
    const result = prepare(controller.signal);
    controller.abort();
    expect(await result).toBe("cancelled");
    expect(compilations).toHaveLength(0);
  });

  it("deduplicates simultaneous preparation without letting one consumer cancel another", async () => {
    const { prepare, compilations } = fixture();
    const controller = new AbortController();
    const first = prepare(controller.signal);
    const second = prepare();
    await Promise.resolve();
    expect(compilations).toHaveLength(1);
    controller.abort();
    expect(await first).toBe("cancelled");
    compilations[0]!.resolve();
    expect(await second).toBe("ready");
  });

  it("never promotes an aborted consumer when the driver completes later", async () => {
    const { prepare, compilations } = fixture();
    const controller = new AbortController();
    let promoted = false;
    const result = prepare(controller.signal).then((status) => {
      if (status === "ready") promoted = true;
      return status;
    });
    await Promise.resolve();
    controller.abort();
    expect(await result).toBe("cancelled");
    compilations[0]!.resolve();
    await Promise.resolve();
    expect(promoted).toBe(false);
  });

  it("allows a fresh attempt after a compilation rejects", async () => {
    const { prepare, compilations } = fixture();
    const first = prepare();
    await Promise.resolve();
    expect(compilations).toHaveLength(1);
    const failure = expect(first).rejects.toThrow("driver failed");
    compilations[0]!.reject(new Error("driver failed"));
    await failure;
    const retry = prepare();
    await Promise.resolve();
    expect(compilations).toHaveLength(2);
    compilations[1]!.resolve();
    expect(await retry).toBe("ready");
  });

  it("cancels an old context generation and does not reuse its pending compilation", async () => {
    const { prepare, compilations, renderer } = fixture();
    const stale = prepare();
    await Promise.resolve();
    invalidateScenePrograms(renderer);
    expect(await stale).toBe("cancelled");
    const restored = prepare();
    await Promise.resolve();
    expect(compilations).toHaveLength(2);
    compilations[0]!.resolve();
    compilations[1]!.resolve();
    expect(await restored).toBe("ready");
  });

  it("prepares again after success because materials or lighting may have changed", async () => {
    const { prepare, compilations } = fixture();
    const first = prepare();
    await Promise.resolve();
    expect(compilations).toHaveLength(1);
    compilations[0]!.resolve();
    expect(await first).toBe("ready");
    const changed = prepare();
    await Promise.resolve();
    expect(compilations).toHaveLength(2);
    compilations[1]!.resolve();
    expect(await changed).toBe("ready");
  });

  it("reports unsupported async preparation without a blocking synchronous compile", async () => {
    let blockingCompiles = 0;
    const renderer = { compileAsync: undefined, compile: () => blockingCompiles++ };
    const status = await prepareScenePrograms(
      renderer,
      new Group(),
      new PerspectiveCamera(),
      new AbortController().signal,
      new Scene(),
    );
    expect(status).toBe("unsupported");
    expect(blockingCompiles).toBe(0);
  });

  it("keeps an actual hero group hidden until its preparation finishes", async () => {
    const { renderer, object, camera, scene, compilations } = fixture();
    object.visible = false;
    const result = promoteScenePrograms(
      renderer,
      object,
      camera,
      new AbortController().signal,
      scene,
    );
    await Promise.resolve();
    expect(object.visible).toBe(false);
    expect(compilations).toHaveLength(1);
    compilations[0]!.resolve();
    expect(await result).toBe("ready");
    expect(object.visible).toBe(true);
  });

  it("reveals a hero on compilation failure so optional preparation cannot strand it", async () => {
    const { renderer, object, camera, scene, compilations } = fixture();
    object.visible = false;
    const result = promoteScenePrograms(
      renderer,
      object,
      camera,
      new AbortController().signal,
      scene,
    );
    await Promise.resolve();
    expect(compilations).toHaveLength(1);
    compilations[0]!.reject(new Error("driver failed"));
    expect(await result).toBe("failed");
    expect(object.visible).toBe(true);
  });

  it("keeps a cancelled hero hidden even if the driver later resolves", async () => {
    const { renderer, object, camera, scene, compilations } = fixture();
    object.visible = false;
    const controller = new AbortController();
    const result = promoteScenePrograms(renderer, object, camera, controller.signal, scene);
    await Promise.resolve();
    controller.abort();
    expect(await result).toBe("cancelled");
    compilations[0]!.resolve();
    await Promise.resolve();
    expect(object.visible).toBe(false);
  });

  it("bounds an unresponsive driver and reports a visible timeout fallback", async () => {
    vi.useFakeTimers();
    try {
      const { renderer, object, camera, scene } = fixture();
      object.visible = false;
      const result = promoteScenePrograms(
        renderer,
        object,
        camera,
        new AbortController().signal,
        scene,
      );
      await vi.advanceTimersByTimeAsync(2500);
      expect(await result).toBe("timed-out");
      expect(object.visible).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
