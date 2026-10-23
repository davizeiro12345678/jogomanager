import { useThree } from "@react-three/fiber";
import { FrameMetrics } from "@/game/frame-metrics";
import { useEffect, useMemo, useRef } from "react";
import { rendererMetadata } from "@/game/graphics-renderer-metadata";
import { subscribeRenderedFrames } from "@/components/game/graphics-probe";
import { type GpuBackend } from "@/components/game/renderer";
export type Quality = "alta" | "media" | "baixa";

export function FpsMeter({
  onSample,
  backend,
  quality,
}: {
  onSample: (s: FpsSample) => void;
  backend: GpuBackend;
  quality: Quality;
}) {
  const frameTimes = useMemo(() => new FrameMetrics(180 * 60), []);
  const gl = useThree((state) => state.gl);
  const sampleCallback = useRef(onSample);
  sampleCallback.current = onSample;
  useEffect(() => {
    frameTimes.reset();
    let last = 0,
      reportAt = 0,
      started = 0,
      frames = 0;
    return subscribeRenderedFrames(gl, (frame) => {
      if (document.hidden) {
        last = started = reportAt = frames = 0;
        return;
      }
      if (!last) {
        last = started = reportAt = frame.now;
        return;
      }
      const deltaMs = frame.now - last;
      last = frame.now;
      if (frame.now - started < 2000) {
        reportAt = frame.now;
        return;
      }
      frameTimes.add(deltaMs);
      frames += 1;
      if (frame.now - reportAt < 1000) return;
      const fps = (frames * 1000) / (frame.now - reportAt);
      reportAt = frame.now;
      frames = 0;
      const metrics = frameTimes.summary();
      const meanMs = metrics.meanMs;
      const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
      const sample = {
        fps,
        avg: 1000 / Math.max(1, meanMs),
        p95FrameMs: metrics.p95,
        p99FrameMs: metrics.p99,
        onePercentLow: metrics.onePercentLow,
        frameMs: meanMs,
        backend,
        rendererBackend: rendererMetadata(gl).kind,
        quality,
        width: frame.width,
        height: frame.height,
        pixelRatio: frame.dpr,
        triangles: frame.triangles,
        drawCalls: frame.draws,
        geometries: frame.geometries,
        textures: frame.textures,
        programs: frame.programs,
        memoryMb: memory.memory ? Math.round(memory.memory.usedJSHeapSize / 1_048_576) : null,
        measuredAt: new Date().toISOString(),
      };
      sampleCallback.current(sample);
      try {
        localStorage.setItem("manager3d.performance.latest", JSON.stringify(sample));
      } catch {
        // Medição continua visível quando o armazenamento está indisponível.
      }
    });
  }, [gl, quality, backend, frameTimes]);

  return null;
}

export type FpsSample = {
  fps: number;
  avg: number;
  p95FrameMs: number;
  p99FrameMs: number;
  onePercentLow: number;
  frameMs: number;
  backend: GpuBackend;
  quality: Quality;
  width: number;
  height: number;
  triangles: number;
  drawCalls: number;
  memoryMb: number | null;
  measuredAt: string;
};
