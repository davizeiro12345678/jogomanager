import type { WebGLRenderer } from "three";
import { subscribeRenderedFrames } from "./graphics-probe";

/** Only probe startup: synchronous GPU readback is expensive, so stop as soon
 * as the field is consistently visible. Never sample an offscreen target. */
export function observeBlackMatchFrames(gl: WebGLRenderer, startedAt: number, onBlack: () => void) {
  let nextSample = startedAt + 3000;
  let dark = 0;
  let visible = 0;
  let done = false;
  const rgba = new Uint8Array(4);
  return subscribeRenderedFrames(gl, ({ now }) => {
    if (done || now < nextSample) return;
    nextSample = now + 1000;
    const { width, height } = gl.domElement;
    if (width < 8 || height < 8 || gl.getRenderTarget() !== null) return;
    const context = gl.getContext();
    if (context.isContextLost()) return;
    let black = true;
    try {
      for (const y of [0.2, 0.5, 0.8]) {
        for (const x of [0.2, 0.5, 0.8]) {
          context.readPixels(
            Math.floor((width - 1) * x),
            Math.floor((height - 1) * y),
            1,
            1,
            context.RGBA,
            context.UNSIGNED_BYTE,
            rgba,
          );
          if (rgba[0]! > 4 || rgba[1]! > 4 || rgba[2]! > 4) black = false;
        }
      }
    } catch {
      // Some implementations forbid readback; never infer failure from that.
      done = true;
      return;
    }
    dark = black ? dark + 1 : 0;
    visible = black ? 0 : visible + 1;
    if (visible >= 3) done = true;
    if (dark >= 3) {
      done = true;
      onBlack();
    }
  });
}
