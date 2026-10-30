import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { hasNativeWebGPUBackend } from "./renderer";

export type ClusterBudget = Readonly<{
  maxLights: number;
  tileSize: number;
  zSlices: number;
  maxLightsPerCluster: number;
}>;

/** 3D light lists are useful only for many local point lights, not for the
 * three directional lights already used in the normal stadium renderer. */
export function clusteredLightingBudget(quality: "alta" | "media" | "baixa"): ClusterBudget {
  if (quality === "alta")
    return { maxLights: 96, tileSize: 32, zSlices: 16, maxLightsPerCluster: 12 };
  if (quality === "media")
    return { maxLights: 48, tileSize: 48, zSlices: 12, maxLightsPerCluster: 8 };
  return { maxLights: 16, tileSize: 64, zSlices: 8, maxLightsPerCluster: 4 };
}

function optedIn(name: string): boolean {
  try {
    return globalThis.localStorage?.getItem(name) === "on";
  } catch {
    return false;
  }
}

/** Experimental WebGPU clustered forward lighting, with full restoration
 * of the renderer's previous lighting model on every scene change. */
export function WebGpuClusteredLighting({
  enabled,
  quality,
}: {
  enabled: boolean;
  quality: "alta" | "media" | "baixa";
}) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (
      !enabled ||
      !hasNativeWebGPUBackend(gl) ||
      !optedIn("manager3d.webgpu.clusteredLighting")
    ) return;
    const renderer = gl as typeof gl & { lighting?: unknown };
    const previous = renderer.lighting;
    let current: unknown;
    let live = true;
    void import("three/addons/lighting/ClusteredLighting.js")
      .then(({ ClusteredLighting }) => {
        if (!live) return;
        const b = clusteredLightingBudget(quality);
        current = new ClusteredLighting(
          b.maxLights,
          b.tileSize,
          b.zSlices,
          b.maxLightsPerCluster,
        );
        renderer.lighting = current;
      })
      .catch(() => {
        // The stable non-clustered lighting model is always the fallback.
      });
    return () => {
      live = false;
      if (current && renderer.lighting === current) renderer.lighting = previous;
    };
  }, [gl, quality, enabled]);
  return null;
}

/** Precompile shader permutations after the first stable frames. Running
 * this during initial paint would make mobile startup and LCP worse. */
export function WebGpuPipelinePrewarm({ enabled }: { enabled: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (
      !enabled ||
      !hasNativeWebGPUBackend(gl) ||
      !optedIn("manager3d.webgpu.psoPrewarm")
    ) return;
    const renderer = gl as typeof gl & {
      compileAsync?: (scene: typeof scene, camera: typeof camera) => Promise<void>;
    };
    let active = true;
    let idleId: number | undefined;
    const timer = setTimeout(() => {
      const run = () => {
        if (!active) return;
        void renderer.compileAsync?.(scene, camera).catch(() => {
          // Driver and pipeline failures must not interrupt live matches.
        });
      };
      if (typeof requestIdleCallback === "function")
        idleId = requestIdleCallback(run, { timeout: 2000 });
      else run();
    }, 3500);
    return () => {
      active = false;
      clearTimeout(timer);
      if (idleId !== undefined && typeof cancelIdleCallback === "function")
        cancelIdleCallback(idleId);
    };
  }, [gl, scene, camera, enabled]);
  return null;
}
