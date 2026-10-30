import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/** Room-local irradiance baking is experimental and explicitly opt-in. */
export function probeGIOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.cinema.probeGI") === "on";
  } catch {
    return false;
  }
}

/** Avoids sampling out-of-room probes that would color neighboring interiors. */
export const CINEMATIC_PROBE_BOUNDS = {
  width: 8,
  height: 4,
  depth: 8,
  resolution: 2,
  falloff: 0.35,
} as const;

export function CinematicProbeGI({ enabled }: { enabled: boolean }) {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!enabled || !probeGIOptedIn()) return;
    let active = true;
    let grid: { dispose(): void; removeFromParent(): void } | null = null;
    // Bake only once once React has mounted the environment. Keep the volume
    // small and the cubemap cheap; never rebake every animation frame.
    const timer = setTimeout(() => {
      void import("three/addons/lighting/LightProbeGridWebGL.js")
        .then(({ LightProbeGridWebGL }) => {
          if (!active || !renderer.isWebGLRenderer) return;
          const settings = CINEMATIC_PROBE_BOUNDS;
          const volume = new LightProbeGridWebGL(
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
            volume.bake(renderer, scene, { cubemapSize: 16, near: 0.08, far: 10 });
            if (!active) {
              volume.dispose();
              return;
            }
            scene.add(volume);
            grid = volume;
          } catch {
            volume.dispose();
            // Ordinary cinematic lighting remains operational.
          }
        })
        .catch(() => {
          // Probe extension unsupported: retain the existing stable lighting.
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
