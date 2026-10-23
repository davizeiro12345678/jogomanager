import { useFrame, useThree } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { useCinematicRuntime } from "./cinematic-runtime";
import { cinematicGestureAt } from "@/game/cinematic-cue";
import { cinematicDrillFor } from "@/game/cinematic-action";
import { CinematicFrameBoundary } from "@/game/cinematic-frame-boundary";

/** Local diagnostics, sampled once a second without React frame updates. */
export function CinematicFrameProbe({
  host,
  openedAt,
  stopped,
  onVisible,
  onReady,
  onSample,
}: {
  host: RefObject<HTMLDivElement | null>;
  openedAt: number;
  stopped: boolean;
  onVisible?: (() => void) | undefined;
  onReady?: (() => void) | undefined;
  onSample?: ((fps: number, p95: number) => void) | undefined;
}) {
  const runtime = useCinematicRuntime();
  const invalidate = useThree((state) => state.invalidate);
  const boundary = useRef(new CinematicFrameBoundary());
  const sample = useRef({
    frames: 0,
    seconds: 0,
    times: [] as number[],
    visible: false,
    ready: false,
  });
  useFrame(({ gl, camera }, dt) => {
    const draws = gl.info.render.calls;
    const triangles = gl.info.render.triangles;
    gl.info.reset();
    const element = host.current;
    if (!element) return;
    const current = sample.current;
    if (draws > 0) {
      element.dataset["cinematicDraws"] = String(draws);
      element.dataset["cinematicTriangles"] = String(triangles);
    }
    element.dataset["cinematicTime"] = runtime.clock.time.toFixed(3);
    element.dataset["cinematicLineTime"] = runtime.clock.lineTime.toFixed(3);
    element.dataset["cinematicGesture"] = runtime.cue?.gesture ?? "idle";
    element.dataset["cinematicDeliveryPhase"] = runtime.cue
      ? cinematicGestureAt(runtime.clock.lineTime, runtime.cue, 21).phase
      : "rest";
    element.dataset["cinematicDrill"] = cinematicDrillFor(runtime.cue?.id.split(":")[0]);
    element.dataset["cinematicSubject"] = String(
      camera.userData["cinematicSubject"] ?? "environment",
    );
    element.dataset["cinematicActorPresence"] = String(
      camera.userData["cinematicActorPresence"] ?? "environment",
    );
    element.dataset["cinematicShotType"] = String(camera.userData["cinematicShotType"] ?? "master");
    element.dataset["cinematicFraming"] = String(
      camera.userData["cinematicFraming"] ?? "establishing",
    );
    if (!current.visible) {
      current.visible = true;
      element.dataset["firstFrameMs"] = (performance.now() - openedAt).toFixed(1);
      onVisible?.();
    }
    if (!current.ready && ++current.frames >= 4) {
      current.ready = true;
      element.dataset["interactiveFrameMs"] = (performance.now() - openedAt).toFixed(1);
      element.dataset["cinematicReady"] = "true";
      onReady?.();
    }
    // Paused/reduced scenes use demand rendering. Finish the bounded warm-up
    // even when no animation schedules another frame, then let rendering sleep.
    if (!current.ready) invalidate();
    const activeDelta = boundary.current.sample(dt, stopped || !current.ready);
    if (activeDelta === null) {
      current.seconds = 0;
      current.times.length = 0;
      return;
    }
    current.seconds += activeDelta;
    current.times.push(activeDelta * 1000);
    if (current.seconds < 1) return;
    const sorted = current.times.sort((a, b) => a - b);
    element.dataset["cinematicFps"] = (sorted.length / current.seconds).toFixed(1);
    element.dataset["frameP95Ms"] = sorted[Math.floor((sorted.length - 1) * 0.95)]!.toFixed(1);
    element.dataset["cinematicDraws"] = String(draws);
    element.dataset["cinematicTriangles"] = String(triangles);
    onSample?.(sorted.length / current.seconds, sorted[Math.floor((sorted.length - 1) * 0.95)]!);
    current.seconds = 0;
    current.times.length = 0;
  }, -80);
  return null;
}
