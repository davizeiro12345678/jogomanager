import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type * as THREE from "three";
import { CINEMATIC_PROBE_BOUNDS, probeGIOptedIn } from "@/game/graphics/cinematic-probe-settings";
import { hasNativeWebGPUBackend } from "../renderer";

/**
 * Experimental one-time room-local irradiance bake. Never share a probe
 * volume across unrelated cinematic sets. WebGPU supports a bounded falloff
 * in r186, which avoids carrying a room's irradiance into distant spaces.
 * Full DDGI visibility weighting is an upstream experiment, not available
 * in the installed r186 LightProbeGrid.
 */
export function CinematicProbeGI({ enabled }: { enabled: boolean }) {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!enabled || !probeGIOptedIn()) return;
    let active = true;
    let grid: { dispose(): void; removeFromParent(): void } | null = null;
    const timer = setTimeout(() => {
      const settings = CINEMATIC_PROBE_BOUNDS;
      const native = hasNativeWebGPUBackend(renderer);
      void (async () => {
        if (native) {
          const { LightProbeGrid } = await import("three/addons/lighting/LightProbeGrid.js");
          if (!active) return;
          const volume = new LightProbeGrid(
            settings.width,
            settings.height,
            settings.depth,
            settings.resolution,
            settings.resolution,
            settings.resolution,
          );
          volume.position.set(0, settings.height / 2, 0);
          volume.falloff = settings.falloff;
          try {
            volume.bake(renderer as unknown as import("three/webgpu").WebGPURenderer, scene, {
              cubemapSize: 16,
              near: 0.08,
              far: 10,
              sampleCount: 128,
            });
            if (!active) {
              volume.dispose();
              return;
            }
            scene.add(volume);
            grid = volume;
          } catch {
            volume.dispose();
          }
          return;
        }
        // The WebGL-only probe calls WebGLRenderer methods during its bake;
        // a WebGPURenderer using an internal WebGL backend is NOT equivalent.
        if (!(renderer as THREE.WebGLRenderer & { isWebGLRenderer?: boolean }).isWebGLRenderer)
          return;
        const { LightProbeGridWebGL } =
          await import("three/addons/lighting/LightProbeGridWebGL.js");
        if (!active) return;
        const volume = new LightProbeGridWebGL(
          settings.width,
          settings.height,
          settings.depth,
          settings.resolution,
          settings.resolution,
          settings.resolution,
        );
        volume.position.set(0, settings.height / 2, 0);
        try {
          volume.bake(renderer as THREE.WebGLRenderer, scene, {
            cubemapSize: 16,
            near: 0.08,
            far: 10,
          });
          if (!active) {
            volume.dispose();
            return;
          }
          scene.add(volume);
          grid = volume;
        } catch {
          volume.dispose();
        }
      })().catch(() => {
        // Unsupported drivers retain the regular cinematic lighting.
      });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      grid?.removeFromParent();
      grid?.dispose();
    };
  }, [enabled, renderer, scene]);
  return null;
}
