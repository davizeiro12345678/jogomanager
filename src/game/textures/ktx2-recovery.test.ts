import type { WebGLRenderer } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { disposeKtx2, ktx2, onKtx2Ready, retainKtx2 } from "./ktx2";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("three/examples/jsm/loaders/KTX2Loader.js", () => ({
  KTX2Loader: class {
    workerConfig = { bptcSupported: true };
    load = load;
    dispose() {}
    detectSupport() {
      return this;
    }
    setTranscoderPath() {
      return this;
    }
    setWorkerLimit() {
      return this;
    }
  },
}));
vi.mock("@/game/device-workload", () => ({ deviceTextureDecodeWorkers: () => 1 }));

afterEach(() => {
  disposeKtx2();
  vi.unstubAllGlobals();
});

it("requeues mounted material textures after the last renderer is lost and reacquired", async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", {});
  const renderer = {} as WebGLRenderer;
  const release = retainKtx2(renderer);
  ktx2("hairDetailNormal");
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);

  const refresh = vi.fn(() => ktx2("hairDetailNormal"));
  const unsubscribe = onKtx2Ready(refresh);
  const releasePeer = retainKtx2({} as WebGLRenderer);
  try {
    releasePeer();
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();

    release();
    const releaseReattached = retainKtx2(renderer);
    try {
      await Promise.resolve();
      expect(refresh).not.toHaveBeenCalled();
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      releaseReattached();
    }
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledExactlyOnceWith(true);

    const releaseRestored = retainKtx2(renderer);
    try {
      await Promise.resolve();
      expect(refresh).toHaveBeenNthCalledWith(2, false);
      expect(load).toHaveBeenCalledTimes(2);
      expect(load.mock.calls[1]?.[0]).toBe("/textures/detail-v1/hair-normal.ktx2");
    } finally {
      releaseRestored();
    }
  } finally {
    release();
    unsubscribe();
  }
});
