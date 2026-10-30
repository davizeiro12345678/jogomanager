import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { TemporalCameraHistory, temporalAAOptedIn } from "@/game/graphics/temporal-settings";
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
  const recreatePipeline = useRef<(() => void) | null>(null);
  const releasePipeline = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hasNativeWebGPUBackend(gl) || !temporalAAOptedIn()) return;
    let live = true;
    history.current.reset();
    void Promise.all([
      import("three/webgpu"),
      import("three/tsl"),
      import("three/addons/tsl/display/TRAANode.js"),
    ])
      .then(([webgpu, tsl, nodes]) => {
        if (!live) return;
        const renderer = gl as unknown as InstanceType<typeof webgpu.WebGPURenderer>;
        const create = () => {
          const pass = tsl.pass(scene, camera);
        pass.setMRT(tsl.mrt({ output: tsl.output, velocity: tsl.velocity }));
        const effect = nodes.traa(
          pass.getTextureNode("output"),
          pass.getTextureNode("depth"),
          pass.getTextureNode("velocity"),
          camera,
        );
        // Reprojection rejects mismatching previous depth and large motion
        // instead of accumulating outdated silhouettes after player movement.
        effect.depthThreshold = 0.0005;
        effect.maxVelocityLength = 64;
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
      history.current.reset();
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
    if (history.current.discontinuity(camera)) {
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
