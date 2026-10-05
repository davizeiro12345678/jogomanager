import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { useCinematicRuntime } from "./cinematic-runtime";
import { cinematicGestureAt } from "@/game/cinematic-cue";
import { cinematicDrillFor } from "@/game/cinematic-action";

/** Local diagnostics, sampled once a second without React frame updates. */
export function CinematicFrameProbe({
  host,
  openedAt,
  stopped,
  onVisible,
  onReady,
}: {
  host: RefObject<HTMLDivElement | null>;
  openedAt: number;
  stopped: boolean;
  onVisible?: (() => void) | undefined;
  onReady?: (() => void) | undefined;
}) {
  const runtime = useCinematicRuntime();
  const sample = useRef({
    frames: 0,
    seconds: 0,
    diagnosticsSeconds: 1,
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
    current.diagnosticsSeconds += dt;
    if (current.diagnosticsSeconds >= 0.25 || !current.visible) {
      current.diagnosticsSeconds = 0;
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
      element.dataset["cinematicShotType"] = String(
        camera.userData["cinematicShotType"] ?? "master",
      );
      element.dataset["cinematicFraming"] = String(
        camera.userData["cinematicFraming"] ?? "establishing",
      );
    }
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
  }, -80);
  return null;
}
