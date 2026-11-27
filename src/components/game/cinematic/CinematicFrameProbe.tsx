import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { FrameMetrics, heapUsedBytes } from "@/game/frame-metrics";
import { FrameCampaign } from "@/game/frame-campaign";
import { rendererMetadata } from "@/game/graphics-renderer-metadata";
import { censusScene } from "@/game/scene-census";
import { gpuTextureStats } from "@/game/textures/ktx2";
import { useCinematicRuntime } from "./cinematic-runtime";
import { cinematicGestureAt } from "@/game/cinematic-cue";
import { cinematicDrillFor } from "@/game/cinematic-action";
import { subscribeRenderedFrames } from "../graphics-probe";

/** Match and dialogue share the same completed-render sampling contract. */
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
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const runtime = useCinematicRuntime();
  const current = useRef({ runtime, stopped, onVisible, onReady, onSample });
  current.current = { runtime, stopped, onVisible, onReady, onSample };
  const interruptSampling = useRef<(() => void) | null>(null);
  useEffect(() => {
    const metrics = new FrameMetrics(600);
    const campaign = new FrameCampaign(90_000);
    const backend = rendererMetadata(gl);
    let visible = false;
    let report = 0;
    let drawSum = 0;
    let triangleSum = 0;
    let frames = 0;
    const interrupt = () => {
      campaign.interrupt();
      metrics.reset();
      drawSum = triangleSum = frames = 0;
      report = 0;
    };
    interruptSampling.current = interrupt;
    document.addEventListener("visibilitychange", interrupt);
    const publishClosedCampaign = (
      snapshot: ReturnType<FrameCampaign["snapshot"]>,
      reason: "context-changed" | "probe-disposed" | "snapshot-request",
    ) =>
      window.dispatchEvent(
        new CustomEvent("cinematic-campaign", {
          detail: {
            ...snapshot,
            reason,
            closed: reason !== "snapshot-request",
            sceneCompletionVerified: false,
            backend,
          },
        }),
      );
    const snapshotRequested = () =>
      publishClosedCampaign(campaign.snapshot(true), "snapshot-request");
    window.addEventListener("frame-campaign-snapshot-request", snapshotRequested);
    const stop = subscribeRenderedFrames(gl, (frame) => {
      const element = host.current;
      if (!element) return;
      const state = current.current;
      const time = state.runtime.clock;
      element.dataset["cinematicTime"] = time.time.toFixed(3);
      element.dataset["cinematicLineTime"] = time.lineTime.toFixed(3);
      element.dataset["cinematicGesture"] = state.runtime.cue?.gesture ?? "idle";
      element.dataset["cinematicDeliveryPhase"] = state.runtime.cue
        ? cinematicGestureAt(time.lineTime, state.runtime.cue, 21).phase
        : "rest";
      element.dataset["cinematicDrill"] = cinematicDrillFor(state.runtime.cue?.id.split(":")[0]);
      for (const key of [
        "cinematicSubject",
        "cinematicActorPresence",
        "cinematicShotType",
        "cinematicFraming",
      ]) {
        element.dataset[key] = String(camera.userData[key] ?? "environment");
      }
      element.dataset["cinematicDraws"] = String(frame.draws);
      element.dataset["cinematicTriangles"] = String(frame.triangles);
      element.dataset["renderWidth"] = String(frame.width);
      element.dataset["renderHeight"] = String(frame.height);
      element.dataset["renderDpr"] = String(frame.dpr);
      element.dataset["rendererBackend"] = backend.kind;
      element.dataset["rendererClass"] = backend.rendererClass;
      element.dataset["cinematicGpu"] = backend.gpuRenderer ?? "unverified";
      if (!visible) {
        visible = true;
        element.dataset["firstFrameMs"] = (frame.now - openedAt).toFixed(1);
        element.dataset["interactiveFrameMs"] = (frame.now - openedAt).toFixed(1);
        element.dataset["cinematicReady"] = "true";
        state.onVisible?.();
        state.onReady?.();
      }
      const observed = campaign.observeFrame(
        frame.now,
        {
          phase: "cutscene",
          quality: state.runtime.quality,
          key: JSON.stringify({
            openedAt,
            scene: state.runtime.cue?.id.split(":")[0] ?? "unidentified",
            set: element.dataset["cinematicSet"] ?? "unidentified",
            quality: state.runtime.quality,
            pressure: element.dataset["cinematicPressure"] ?? "unverified",
            width: frame.width,
            height: frame.height,
            dpr: frame.dpr,
          }),
        },
        state.stopped || document.hidden,
      );
      if (observed.previous) {
        publishClosedCampaign(observed.previous, "context-changed");
        metrics.reset();
        drawSum = triangleSum = frames = 0;
        report = 0;
      }
      if (state.stopped || document.hidden) {
        metrics.reset();
        drawSum = triangleSum = frames = 0;
        report = 0;
        return;
      }
      if (observed.intervalMs > 0) {
        metrics.add(observed.intervalMs);
        drawSum += frame.draws;
        triangleSum += frame.triangles;
        frames += 1;
      }
      if (report === 0) report = frame.now;
      if (frame.now - report < 1000) return;
      const summary = metrics.summary();
      const census = censusScene(scene);
      element.dataset["cinematicFps"] = summary.fps.toFixed(1);
      element.dataset["frameP95Ms"] = summary.p95.toFixed(1);
      element.dataset["frameResources"] = JSON.stringify({
        geometries: frame.geometries,
        textures: frame.textures,
        programs: frame.programs,
        materials: census.materials,
        geometryBytes: census.total.geometryBytes,
        textureBytes: census.total.textureBytes,
        compressed: { ...gpuTextureStats },
      });
      window.dispatchEvent(
        new CustomEvent("cinematic-sample", {
          detail: {
            ...summary,
            ...frame,
            phase: "cutscene",
            quality: state.runtime.quality,
            campaign: campaign.snapshot(),
            backend,
            elapsed: (frame.now - openedAt) / 1000,
            draws: frames ? drawSum / frames : frame.draws,
            triangles: frames ? triangleSum / frames : frame.triangles,
            heapUsedBytes: heapUsedBytes(),
            census,
            measurement: "completed renders; visible running scene; one second window",
          },
        }),
      );
      state.onSample?.(summary.fps, summary.p95);
      metrics.reset();
      drawSum = triangleSum = frames = 0;
      report = frame.now;
    });
    return () => {
      stop();
      document.removeEventListener("visibilitychange", interrupt);
      window.removeEventListener("frame-campaign-snapshot-request", snapshotRequested);
      if (interruptSampling.current === interrupt) interruptSampling.current = null;
      publishClosedCampaign(campaign.snapshot(true), "probe-disposed");
    };
  }, [gl, camera, scene, host, openedAt]);
  useEffect(() => {
    // A paused/demand scene may deliver no frame at all. Clear the baseline
    // on both edges so resuming cannot turn stopped wall time into a stall.
    interruptSampling.current?.();
  }, [stopped]);
  return null;
}
