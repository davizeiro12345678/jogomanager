import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";

const effect = vi.hoisted(() => ({ run: undefined as (() => void) | undefined, stop: vi.fn() }));
vi.mock("@react-three/fiber", () => ({
  addAfterEffect: (callback: () => void) => {
    effect.run = callback;
    return effect.stop;
  },
}));
import { subscribeRenderedFrames } from "./graphics-probe";

describe("completed renderer frame probes", () => {
  afterEach(() => vi.clearAllMocks());
  it("reads native WebGPU draw calls without treating its cumulative render counter as a draw count", () => {
    const gl = {
      info: {
        autoReset: true,
        render: { calls: 8, drawCalls: 0, triangles: 0 },
        memory: { geometries: 4, textures: 7, programs: 3 },
        reset: () => {
          gl.info.render.drawCalls = gl.info.render.triangles = 0;
        },
      },
      domElement: { width: 1280, height: 720 },
      getPixelRatio: () => 1,
    };
    const sample = vi.fn();
    const release = subscribeRenderedFrames(gl as unknown as WebGLRenderer, sample);
    gl.info.render.calls = 11;
    gl.info.render.drawCalls = 19;
    gl.info.render.triangles = 1200;
    effect.run!();
    expect(sample).toHaveBeenCalledOnce();
    expect(sample.mock.calls[0]![0]).toMatchObject({ draws: 19, programs: 3, triangles: 1200 });
    effect.run!();
    expect(sample).toHaveBeenCalledOnce();
    release();
  });
  it("counts all passes once, skips a paused Canvas, and restores ownership after the final subscriber", () => {
    const reset = vi.fn(() => {
      gl.info.render.calls = gl.info.render.triangles = 0;
    });
    const gl = {
      info: {
        autoReset: true,
        render: { frame: 0, calls: 0, triangles: 0 },
        memory: { geometries: 4, textures: 7 },
        programs: [1, 2],
        reset,
      },
      domElement: { width: 1280, height: 720 },
      getPixelRatio: () => 1,
    };
    const first = vi.fn(),
      second = vi.fn();
    const releaseFirst = subscribeRenderedFrames(gl as unknown as WebGLRenderer, first);
    const releaseSecond = subscribeRenderedFrames(gl as unknown as WebGLRenderer, second);
    expect(gl.info.autoReset).toBe(false);
    effect.run!();
    expect(first).not.toHaveBeenCalled();
    gl.info.render.frame = 3;
    gl.info.render.calls = 24;
    gl.info.render.triangles = 1200;
    effect.run!();
    expect(first.mock.calls[0]![0]).toMatchObject({
      draws: 24,
      triangles: 1200,
      width: 1280,
      height: 720,
      dpr: 1,
    });
    expect(second.mock.calls[0]![0]).toEqual(first.mock.calls[0]![0]);
    expect(reset).toHaveBeenCalledTimes(1);
    effect.run!(); // Another Canvas may tick while this Canvas stays paused.
    expect(first).toHaveBeenCalledTimes(1);
    releaseFirst();
    expect(gl.info.autoReset).toBe(false);
    releaseSecond();
    releaseSecond();
    expect(gl.info.autoReset).toBe(true);
    expect(effect.stop).toHaveBeenCalledTimes(1);
  });
});
