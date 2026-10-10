import type { WebGLRenderer } from "three";
import { subscribeRenderedFrames } from "./graphics-probe";

export type CanvasStatus = "loading" | "ready" | "lost";

/** Context restoration rebuilds Three's GPU resources. Readiness is emitted
 * only after that Canvas completes a new draw, including demand-rendered views. */
export function observeCanvasLifecycle(
  gl: WebGLRenderer,
  invalidate: () => void,
  onStatus: (status: CanvasStatus) => void,
) {
  let waiting = true;
  let contextLost = false;
  const stop = subscribeRenderedFrames(gl, () => {
    if (!waiting || contextLost) return;
    waiting = false;
    onStatus("ready");
  });
  const lost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    waiting = true;
    onStatus("lost");
  };
  const restored = () => {
    contextLost = false;
    waiting = true;
    onStatus("loading");
    invalidate();
  };
  gl.domElement.addEventListener("webglcontextlost", lost);
  gl.domElement.addEventListener("webglcontextrestored", restored);
  onStatus("loading");
  invalidate();
  return () => {
    stop();
    gl.domElement.removeEventListener("webglcontextlost", lost);
    gl.domElement.removeEventListener("webglcontextrestored", restored);
  };
}
