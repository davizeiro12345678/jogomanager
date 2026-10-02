import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";

/** Local diagnostics, sampled once a second without React frame updates. */
export function CinematicFrameProbe({
  host,
  openedAt,
  stopped,
  onReady,
}: {
  host: RefObject<HTMLDivElement | null>;
  openedAt: number;
  stopped: boolean;
  onReady?: (() => void) | undefined;
}) {
  const sample = useRef({ frames: 0, seconds: 0, times: [] as number[], ready: false });
  useFrame(({ gl }, dt) => {
    const draws = gl.info.render.calls;
    const triangles = gl.info.render.triangles;
    gl.info.reset();
    const element = host.current;
    if (!element) return;
    const current = sample.current;
    if (!current.ready && ++current.frames >= 4) {
      current.ready = true;
      element.dataset["firstFrameMs"] = (performance.now() - openedAt).toFixed(1);
      element.dataset["cinematicReady"] = "true";
      onReady?.();
    }
    if (stopped) {
      current.seconds = 0;
      current.times.length = 0;
      return;
    }
    if (!current.ready || dt <= 0) return;
    current.seconds += dt;
    current.times.push(dt * 1000);
    if (current.seconds < 1) return;
    const sorted = current.times.sort((a, b) => a - b);
    element.dataset["cinematicFps"] = (sorted.length / current.seconds).toFixed(1);
    element.dataset["frameP95Ms"] = sorted[Math.floor((sorted.length - 1) * 0.95)]!.toFixed(1);
    element.dataset["cinematicDraws"] = String(draws);
    element.dataset["cinematicTriangles"] = String(triangles);
    current.seconds = 0;
    current.times.length = 0;
  }, -101);
  return null;
}
