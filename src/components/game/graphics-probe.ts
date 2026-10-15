import { addAfterEffect } from "@react-three/fiber";
import type { WebGLRenderer } from "three";

export type RenderedFrameSample = Readonly<{
  now: number;
  draws: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number | null;
  width: number;
  height: number;
  dpr: number;
}>;
type Probe = { listeners: Set<(sample: RenderedFrameSample) => void>; stop: () => void };
const probes = new WeakMap<WebGLRenderer, Probe>();

/** One post-render owner reads every pass before one reset. R3F after-effects
 * are global, so a different Canvas ticking must never count a paused scene. */
export function subscribeRenderedFrames(
  gl: WebGLRenderer,
  callback: (sample: RenderedFrameSample) => void,
): () => void {
  let probe = probes.get(gl);
  if (!probe) {
    const listeners = new Set<(sample: RenderedFrameSample) => void>();
    const prior = gl.info.autoReset;
    gl.info.autoReset = false;
    // Native Three WebGPU counts cumulative render calls and exposes actual
    // draw calls separately; WebGL exposes a frame id and per-frame calls.
    const info = gl.info as typeof gl.info & {
      render: { drawCalls?: number };
      memory: { programs?: number };
    };
    const frameId = () => info.render.frame ?? info.render.calls;
    let lastFrame = frameId();
    const stop = addAfterEffect(() => {
      const frame = frameId();
      const draws = info.render.drawCalls ?? info.render.calls;
      if (frame === lastFrame || draws === 0) return;
      lastFrame = frame;
      const sample: RenderedFrameSample = {
        now: performance.now(),
        draws,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: info.programs?.length ?? info.memory.programs ?? null,
        width: gl.domElement.width,
        height: gl.domElement.height,
        dpr: gl.getPixelRatio(),
      };
      for (const listener of listeners) listener(sample);
      gl.info.reset();
    });
    probe = {
      listeners,
      stop: () => {
        stop();
        gl.info.autoReset = prior;
      },
    };
    probes.set(gl, probe);
  }
  const activeProbe = probe;
  activeProbe.listeners.add(callback);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeProbe.listeners.delete(callback);
    if (activeProbe.listeners.size === 0) {
      activeProbe.stop();
      probes.delete(gl);
    }
  };
}
