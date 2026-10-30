import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

/** Experimental, opt-in CSM: WebGPU only. Normal WebGL shadows stay intact. */
export function csmOptedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem("manager3d.webgpu.csm") === "on";
  } catch {
    return false;
  }
}

type CsmShadow = {
  camera: THREE.Camera | null;
  updateFrustums: () => void;
};

export function useWebGpuCsmShadow(
  sunRef: RefObject<THREE.DirectionalLight | null>,
  enabled: boolean,
) {
  const camera = useThree((state) => state.camera);
  const node = useRef<CsmShadow | null>(null);
  const previousProjection = useRef(new THREE.Matrix4());

  useEffect(() => {
    if (!enabled || !csmOptedIn()) return;
    let alive = true;
    const sun = sunRef.current;
    if (!sun?.castShadow) return;
    const shadow = sun.shadow as THREE.DirectionalLightShadow & { shadowNode?: CsmShadow };
    void import("three/addons/csm/CSMShadowNode.js")
      .then(({ CSMShadowNode }) => {
        if (!alive) return;
        const csm = new CSMShadowNode(sun, {
          cascades: 3,
          maxFar: Math.min(camera.far, 175),
          mode: "practical",
          lightMargin: 12,
        });
        csm.camera = camera;
        csm.updateFrustums();
        shadow.shadowNode = csm;
        node.current = csm;
        previousProjection.current.copy(camera.projectionMatrix);
      })
      .catch(() => {
        // Keep normal directional shadow maps in unsupported WebGPU drivers.
      });
    return () => {
      alive = false;
      if (node.current && shadow.shadowNode === node.current) {
        delete shadow.shadowNode;
        sun.shadow.needsUpdate = true;
      }
      node.current = null;
    };
  }, [sunRef, camera, enabled]);

  // Frustum splits depend on camera projection, not on every frame's
  // movement. In particular the broadcast FOV changes during goal zooms.
  useFrame(() => {
    if (!node.current) return;
    if (!previousProjection.current.equals(camera.projectionMatrix)) {
      previousProjection.current.copy(camera.projectionMatrix);
      node.current.updateFrustums();
    }
  });
}
