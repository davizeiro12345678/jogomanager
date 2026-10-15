import { subscribeRenderedFrames } from "./graphics-probe";
import { rendererMetadata } from "@/game/graphics-renderer-metadata";
import { reportSilent } from "@/lib/silent-errors";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { FrameMetrics, heapUsedBytes } from "@/game/frame-metrics";
import { FrameRateWindow } from "@/game/frame-rate-window";
import {
  assessNativePerformance,
  nativeMeasurementTiming,
  nativeFrameInterval,
} from "@/game/native-performance-contract";
import { censusBudgetUse, censusFitsBudget, censusScene } from "@/game/scene-census";

type GraphicsBenchmarkMetadata = {
  tierBatch?: "instanced" | "merged" | "legacy";
  id: string;
  label: string;
  seed: string;
  quality: string;
  presetCamera: string;
  camera: string;
  time: string;
  weather: string;
  mow: string;
  fixture: { homeClubId: string; awayClubId: string; label: string };
  viewport: { width: number; height: number; dpr: number };
  requested: {
    scenario: string | null;
    seed: string | null;
    quality: string | null;
    camera: string | null;
  };
};

type BenchmarkNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean; platform?: string };
};

function benchmarkMetadata(): GraphicsBenchmarkMetadata | null {
  const value = (window as Window & { __PFM_GRAPHICS_BENCHMARK__?: unknown })
    .__PFM_GRAPHICS_BENCHMARK__;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GraphicsBenchmarkMetadata>;
  return typeof candidate.id === "string" && typeof candidate.seed === "string"
    ? (candidate as GraphicsBenchmarkMetadata)
    : null;
}

function browserMetadata() {
  const nav = navigator as BenchmarkNavigator;
  return {
    userAgent: nav.userAgent || null,
    platform: nav.userAgentData?.platform ?? nav.platform ?? null,
    language: nav.language || null,
    mobile: nav.userAgentData?.mobile ?? null,
  };
}

function hardwareMetadata(renderer: ReturnType<typeof rendererMetadata>) {
  const nav = navigator as BenchmarkNavigator;
  return {
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemoryGiB: nav.deviceMemory ?? null,
    devicePixelRatio: window.devicePixelRatio || null,
    screen: {
      width: window.screen?.width ?? null,
      height: window.screen?.height ?? null,
      colorDepth: window.screen?.colorDepth ?? null,
    },
    maxTextureSize: renderer.maxTextureSize,
    maxAnisotropy: renderer.maxAnisotropy,
  };
}

/** Opt-in benchmark only: count ALL render passes, then reset once per frame. */
export function FrameProbe({ quality, adaptive }: { quality: string; adaptive: boolean }) {
  const effective = useRef({ quality, adaptive });
  effective.current = { quality, adaptive };
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  // Telemetria opcional (com consentimento): 30 s de amostra após 10 s de partida.
  useEffect(() => {
    if (location.pathname.includes("graphics-benchmark")) return;
    const metrics = new FrameMetrics();
    const start = performance.now();
    let last = start;
    const stop = subscribeRenderedFrames(gl, (frame) => {
      const now = frame.now;
      if (!document.hidden && now - start > 10_000) metrics.add(now - last);
      last = now;
      if (now - start > 40_000) {
        stop();
        const s = metrics.summary();
        void import("@/lib/telemetry-client")
          .then((m) => m.reportTechSample({ fps: s.fps, p95: s.p95 }))
          .catch((error) => {
            reportSilent("telemetry.optional", error, {
              classification: "ignorable",
              feature: "frame-probe",
              phase: "report",
              dedupeKey: "frame-probe-report",
            });
          });
      }
    });
    return stop;
  }, [gl]);
  useEffect(() => {
    if (!location.pathname.includes("graphics-benchmark")) return;
    const meter = new FrameRateWindow();
    return subscribeRenderedFrames(gl, (frame) => {
      const sample = meter.sample(frame.now, document.hidden);
      if (sample) window.dispatchEvent(new CustomEvent("graphics-live", { detail: sample }));
    });
  }, [gl]);
  useEffect(() => {
    if (!location.pathname.includes("graphics-benchmark")) return;
    const timing = nativeMeasurementTiming(location.search);
    const endMs = timing.warmupMs + timing.measurementMs;
    const metrics = new FrameMetrics(90000);
    const start = performance.now();
    let last = start;
    let report = start;
    let interruptions = document.hidden ? 1 : 0;
    let coveredMs = 0;
    let initialContract: string | null = null;
    let contractChanged = false;
    const onVisibility = () => {
      if (document.hidden) interruptions++;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    let firstFrame: number | null = null;
    let longTasks = 0;
    let longTaskMs = 0;
    let drawSum = 0,
      triangleSum = 0,
      maxDraws = 0,
      measured = 0;
    let finalReport = false;

    const renderer = rendererMetadata(gl);
    const browser = browserMetadata();
    let observer: PerformanceObserver | undefined;
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks++;
          longTaskMs += entry.duration;
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    }
    const stop = subscribeRenderedFrames(gl, (frame) => {
      const now = frame.now;
      if (finalReport) {
        return;
      }
      if (firstFrame === null && frame.draws > 0) firstFrame = now - start;
      const currentContract = `${frame.width}:${frame.height}:${frame.dpr}:${effective.current.quality}:${effective.current.adaptive}:${benchmarkMetadata()?.camera}`;
      if (initialContract === null) initialContract = currentContract;
      else if (initialContract !== currentContract) contractChanged = true;
      const interval = nativeFrameInterval(
        last - start,
        now - start,
        timing.warmupMs,
        timing.measurementMs,
      );
      if (!document.hidden && interval > 0) {
        metrics.add(interval);
        coveredMs += interval;
        drawSum += frame.draws;
        triangleSum += frame.triangles;
        maxDraws = Math.max(maxDraws, frame.draws);
        measured++;
      }
      if (now - report >= 1000) {
        report = now;
        const frameSummary = metrics.summary();
        // Censo por subsistema: atribui desenhos/triângulos a jogadores,
        // torcida, grama, props, estrutura, gol, bola e céu. Sem isso, um
        // total de 700 desenhos não diz o que consertar.
        const census = censusScene(scene);
        const staticBatches: {
          eligible: number;
          merged: number;
          draws: number;
          visibleSources: number;
          detachedSources: number;
        }[] = [];
        const actorBatches: {
          sources: number;
          draws: number;
          bones: number;
          visibleSources: number;
        }[] = [];
        scene.traverse((object) => {
          const actors = object.userData["rigidActorBatch"] as
            { sources: { visible: boolean }[]; draws: number; bones: number } | undefined;
          if (actors)
            actorBatches.push({
              sources: actors.sources.length,
              draws: actors.draws,
              bones: actors.bones,
              visibleSources: actors.sources.reduce(
                (count, source) => count + Number(source.visible),
                0,
              ),
            });
          const batch = object.userData["staticBatch"] as
            | {
                eligible: number;
                batches: number;
                sources: { visible: boolean; parent: unknown }[];
              }
            | undefined;
          if (batch)
            staticBatches.push({
              eligible: batch.eligible,
              merged: batch.sources.length,
              draws: batch.batches,
              visibleSources: batch.sources.reduce(
                (count, source) => count + Number(source.visible),
                0,
              ),
              detachedSources: batch.sources.reduce(
                (count, source) => count + Number(!source.parent),
                0,
              ),
            });
        });
        window.dispatchEvent(
          new CustomEvent("graphics-sample", {
            detail: {
              ...frameSummary,
              elapsed: (now - start) / 1000,
              complete: now - start >= endMs,
              protocol: {
                ...timing,
                interruptions,
                coveredMs,
                contractChanged,
                adaptive: effective.current.adaptive,
                longTasksScope: "whole run including warmup",
              },
              acceptance: assessNativePerformance({
                ...frameSummary,
                ...timing,
                complete: now - start >= endMs,
                interruptions,
                coveredMs,
                contractChanged,
                adaptive: effective.current.adaptive,
                width: frame.width,
                height: frame.height,
                dpr: frame.dpr,
                quality:
                  effective.current.quality === benchmarkMetadata()?.quality
                    ? effective.current.quality
                    : "mismatch",
                gpuRenderer: renderer.gpuRenderer,
              }),
              draws: measured ? drawSum / measured : 0,
              maxDraws,
              triangles: measured ? triangleSum / measured : 0,
              heapUsedBytes: heapUsedBytes(performance),
              geometries: frame.geometries,
              textures: frame.textures,
              programs: frame.programs,
              materials: census.materials,
              staticBatches,
              actorBatches,
              census: {
                buckets: census.buckets,
                total: census.total,
                budgetUse: censusBudgetUse(
                  census,
                  benchmarkMetadata()?.quality === "cinema"
                    ? "cinema"
                    : benchmarkMetadata()?.quality === "media"
                      ? "media"
                      : benchmarkMetadata()?.quality === "baixa"
                        ? "baixa"
                        : "alta",
                ),
                fitsBudget: censusFitsBudget(
                  census,
                  benchmarkMetadata()?.quality === "cinema"
                    ? "cinema"
                    : benchmarkMetadata()?.quality === "media"
                      ? "media"
                      : benchmarkMetadata()?.quality === "baixa"
                        ? "baixa"
                        : "alta",
                ),
              },
              firstFrameMs: firstFrame,
              longTasks: observer ? longTasks : null,
              longTaskMs: observer ? longTaskMs : null,
              width: frame.width,
              height: frame.height,
              dpr: frame.dpr,
              scenario: benchmarkMetadata(),
              browser,
              hardware: hardwareMetadata(renderer),
              backend: {
                kind: renderer.kind,
                renderer: renderer.renderer,
                contextVersion: renderer.contextVersion,
                gpuRenderer: renderer.gpuRenderer,
                gpuVendor: renderer.gpuVendor,
                rendererClass: renderer.rendererClass,
              },
            },
          }),
        );
        if (now - start >= endMs) {
          finalReport = true;
          observer?.disconnect();
        }
      }
      last = now;
    });
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, [gl, scene]);
  return null;
}
