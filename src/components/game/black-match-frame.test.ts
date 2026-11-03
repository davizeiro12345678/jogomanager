import { expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";

const probe = vi.hoisted(() => ({
  frame: undefined as ((frame: { now: number }) => void) | undefined,
}));
vi.mock("./graphics-probe", () => ({
  subscribeRenderedFrames: (_gl: unknown, cb: (frame: { now: number }) => void) => {
    probe.frame = cb;
    return () => undefined;
  },
}));
import { observeBlackMatchFrames } from "./black-match-frame";

function fakeRenderer() {
  const pixel = { value: 0, lost: false };
  const context = {
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    isContextLost: () => pixel.lost,
    readPixels: (
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      _format: number,
      _type: number,
      out: Uint8Array,
    ) => {
      out.set([pixel.value, pixel.value, pixel.value, 255]);
    },
  };
  return {
    pixel,
    renderer: {
      domElement: { width: 1280, height: 720 },
      getContext: () => context,
      getRenderTarget: () => null,
    } as unknown as WebGLRenderer,
  };
}

it("requests recovery after three consecutive black completed frames, but not during context loss", () => {
  const { pixel, renderer } = fakeRenderer();
  const recovery = vi.fn();
  observeBlackMatchFrames(renderer, 0, recovery);
  probe.frame!({ now: 3000 });
  pixel.lost = true;
  probe.frame!({ now: 4000 });
  expect(recovery).not.toHaveBeenCalled();
  pixel.lost = false;
  probe.frame!({ now: 5000 });
  expect(recovery).not.toHaveBeenCalled();
  probe.frame!({ now: 6000 });
  expect(recovery).toHaveBeenCalledOnce();
});

it("does not request recovery when a visible frame breaks the black sequence", () => {
  const { pixel, renderer } = fakeRenderer();
  const recovery = vi.fn();
  observeBlackMatchFrames(renderer, 0, recovery);
  probe.frame!({ now: 3000 });
  pixel.value = 80;
  probe.frame!({ now: 4000 });
  pixel.value = 0;
  probe.frame!({ now: 5000 });
  probe.frame!({ now: 6000 });
  expect(recovery).not.toHaveBeenCalled();
});
