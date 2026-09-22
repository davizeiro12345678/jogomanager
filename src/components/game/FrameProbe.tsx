import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { FrameMetrics } from "@/game/frame-metrics";

/** Opt-in benchmark only: count ALL render passes, then reset once per frame. */
export function FrameProbe() {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  useEffect(() => {
    if (!location.pathname.includes("graphics-benchmark")) return;
    const metrics = new FrameMetrics();
    const start = performance.now();
    let last = start;
    let report = start;
    let firstFrame: number | null = null;
    let longTasks = 0;
    let longTaskMs = 0;
    let drawSum = 0, triangleSum = 0, maxDraws = 0, measured = 0;
    const prior = gl.info.autoReset;
    gl.info.autoReset = false;
    let observer: PerformanceObserver | undefined;
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) { longTasks++; longTaskMs += entry.duration; }
      });
      observer.observe({ entryTypes: ["longtask"] });
    }
    const stop = addAfterEffect(() => {
      const now = performance.now();
      if (firstFrame === null && gl.info.render.calls > 0) firstFrame = now - start;
      if (!document.hidden && now - start > 5000 && now - start <= 65000) {
        metrics.add(now - last);
        drawSum += gl.info.render.calls;
        triangleSum += gl.info.render.triangles;
        maxDraws = Math.max(maxDraws, gl.info.render.calls);
        measured++;
      }
      if (now - report >= 1000) {
        report = now;
        const materials = new Set<string>();
        scene.traverse(object => {
          const material = (object as unknown as { material?: { uuid: string } | { uuid: string }[] }).material;
          if (material) for (const item of Array.isArray(material) ? material : [material]) materials.add(item.uuid);
        });
        window.dispatchEvent(new CustomEvent("graphics-sample", { detail: {
          ...metrics.summary(), elapsed: (now - start) / 1000, complete: now - start >= 65000,
          draws: measured ? drawSum / measured : 0, maxDraws,
          triangles: measured ? triangleSum / measured : 0,
          geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? null, materials: materials.size,
          firstFrameMs: firstFrame, longTasks: observer ? longTasks : null,
          longTaskMs: observer ? longTaskMs : null,
          width: gl.domElement.width, height: gl.domElement.height, dpr: gl.getPixelRatio(),
        } }));
      }
      last = now;
      gl.info.reset();
    });
    return () => { stop(); observer?.disconnect(); gl.info.autoReset = prior; };
  }, [gl, scene]);
  return null;
}
