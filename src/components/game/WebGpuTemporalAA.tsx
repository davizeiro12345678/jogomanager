import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  TemporalCameraHistory,
  hasExternalViewOffset,
  temporalAAOptedIn,
  temporalUpscaleOptedIn,
} from "@/game/graphics/temporal-settings";
import { hasNativeWebGPUBackend } from "./renderer";

/**
 * Explicit WebGPU experiment; WebGL2 and ordinary WebGPU use the existing
 * stable render path. TRAA relies on Three r186's MRT velocity and depth.
 */
type TemporalPipeline = {
  render(): void;
  dispose(): void;
};
type TemporalNode = {
  dispose(): void;
  setSize?(width: number, height: number): void;
};

export function WebGpuTemporalAA() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const pipeline = useRef<TemporalPipeline | null>(null);
  const failed = useRef(false);
  const antialias = useRef<TemporalNode | null>(null);
  const history = useRef(new TemporalCameraHistory());
  const hadExternalView = useRef(false);
  const recreatePipeline = useRef<(() => void) | null>(null);
  const releasePipeline = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hasNativeWebGPUBackend(gl) || (!temporalAAOptedIn() && !temporalUpscaleOptedIn())) return;
    let live = true;
    const currentHistory = history.current;
    currentHistory.reset();
    void Promise.all([
      import("three/webgpu"),
      import("three/tsl"),
      import("three/addons/tsl/display/TRAANode.js"),
      import("three/addons/tsl/display/TAAUNode.js"),
    ])
      .then(([webgpu, tsl, nodes, upscaling]) => {
        if (!live) return;
        const renderer = gl as unknown as InstanceType<typeof webgpu.WebGPURenderer>;
        const create = () => {
          const pass = tsl.pass(scene, camera);
          const upscale = temporalUpscaleOptedIn();
          // Native TAAU resolves the reduced render pass into output pixels.
          // The stable TRAA route still renders at full scene resolution.
          pass.setResolutionScale(upscale ? 0.75 : 1);
          pass.setMRT(tsl.mrt({ output: tsl.output, velocity: tsl.velocity }));
          const color = pass.getTextureNode("output");
          const depth = pass.getTextureNode("depth");
          const velocity = pass.getTextureNode("velocity");
          const effect = upscale
            ? upscaling.taau(color, depth, velocity, camera)
            : nodes.traa(color, depth, velocity, camera);
          if (!upscale) {
            const antialias = effect as ReturnType<typeof nodes.traa>;
            antialias.depthThreshold = 0.0005;
            antialias.maxVelocityLength = 64;
          }
          const graph = new webgpu.RenderPipeline(renderer);
          graph.outputNode = effect;
          pipeline.current = graph;
          antialias.current = effect;
          releasePipeline.current = () => {
            if (pipeline.current === graph) pipeline.current = null;
            if (antialias.current === effect) antialias.current = null;
            effect.dispose();
            graph.dispose();
          };
        };
        recreatePipeline.current = create;
        create();
      })
      .catch(() => {
        failed.current = true;
        // The next frame falls back to the usual renderer without history.
      });
    return () => {
      live = false;
      releasePipeline.current?.();
      releasePipeline.current = null;
      recreatePipeline.current = null;
      currentHistory.reset();
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    // Three's temporal effect owns its own jitter and restores its camera
    // view-offset. Do not add a second Halton jitter or override user FOV.
    antialias.current?.setSize?.(Math.max(1, size.width), Math.max(1, size.height));
  }, [size.width, size.height]);

  // Positive priority takes over R3F's final render, preventing a second
  // full-scene pass. React updates/simulation/camera hooks still run normally.
  useFrame(() => {
    // Three r186 TRAANode has no public reset(). Recreate color/depth
    // histories only for real camera cuts or projection discontinuities.
    camera.updateMatrixWorld();
    if (hasExternalViewOffset(camera)) {
      hadExternalView.current = true;
      history.current.reset();
      gl.render(scene, camera);
      return;
    }
    if (hadExternalView.current || history.current.discontinuity(camera)) {
      hadExternalView.current = false;
      releasePipeline.current?.();
      try {
        recreatePipeline.current?.();
      } catch {
        failed.current = true;
      }
      history.current.reset();
    }
    history.current.capture(camera);
    if (failed.current || !pipeline.current) {
      gl.render(scene, camera);
      return;
    }
    pipeline.current.render();
  }, 1);

  return null;
}
