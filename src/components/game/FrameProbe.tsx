import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { FrameMetrics } from "@/game/frame-metrics";
import { censusBudgetUse, censusFitsBudget, censusScene } from "@/game/scene-census";

type GraphicsBenchmarkMetadata = {
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

type BenchmarkRenderer = {
  constructor?: { name?: string };
  isWebGLRenderer?: boolean;
  isWebGPURenderer?: boolean;
  capabilities?: {
    isWebGL2?: boolean;
    maxTextureSize?: number;
    getMaxAnisotropy?: () => number;
  };
  getContext?: () => {
    VERSION?: number;
    getParameter?: (parameter: number) => unknown;
    getExtension?: (
      name: string,
    ) => { UNMASKED_RENDERER_WEBGL?: number; UNMASKED_VENDOR_WEBGL?: number } | null;
  } | null;
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

function rendererMetadata(gl: unknown) {
  const renderer = gl as BenchmarkRenderer;
  const name = renderer.constructor?.name ?? "unknown";
  const isWebGpu = renderer.isWebGPURenderer === true || /webgpu/i.test(name);
  const isWebGl2 = !isWebGpu && (renderer.capabilities?.isWebGL2 === true || /webgl2/i.test(name));
  let contextVersion: string | null = null;
  let gpuRenderer: string | null = null;
  let gpuVendor: string | null = null;
  try {
    const context = renderer.getContext?.();
    if (context?.getParameter && typeof context.VERSION === "number") {
      const value = context.getParameter(context.VERSION);
      contextVersion = typeof value === "string" ? value : null;
      const debug = context.getExtension?.("WEBGL_debug_renderer_info");
      if (debug?.UNMASKED_RENDERER_WEBGL)
        gpuRenderer = String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL));
      if (debug?.UNMASKED_VENDOR_WEBGL)
        gpuVendor = String(context.getParameter(debug.UNMASKED_VENDOR_WEBGL));
    }
  } catch {
    // WebGPU renderers and privacy-hardened browsers may not expose a WebGL context.
  }
  return {
    kind: isWebGpu
      ? "webgpu"
      : isWebGl2
        ? "webgl2"
        : renderer.isWebGLRenderer
          ? "webgl"
          : "unknown",
    renderer: name,
    contextVersion,
    gpuRenderer,
    gpuVendor,
    maxTextureSize: renderer.capabilities?.maxTextureSize ?? null,
    maxAnisotropy: renderer.capabilities?.getMaxAnisotropy?.() ?? null,
  };
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
export function FrameProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  // Telemetria opcional (com consentimento): 30 s de amostra após 10 s de partida.
  useEffect(() => {
    if (location.pathname.includes("graphics-benchmark")) return;
    const metrics = new FrameMetrics();
    const start = performance.now();
    let last = start;
    let sent = false;
    const stop = addAfterEffect(() => {
      const now = performance.now();
      if (!document.hidden && now - start > 10_000) metrics.add(now - last);
      last = now;
      if (!sent && now - start > 40_000) {
        sent = true;
        const s = metrics.summary();
        void import("@/lib/telemetry-client")
          .then((m) => m.reportTechSample({ fps: s.fps, p95: s.p95 }))
          .catch(() => {
            /* Optional telemetry must never break the renderer. */
          });
      }
    });
    return stop;
  }, []);
  useEffect(() => {
    if (!location.pathname.includes("graphics-benchmark")) return;
    const metrics = new FrameMetrics();
    const start = performance.now();
    let last = start;
    let report = start;
    let firstFrame: number | null = null;
    let longTasks = 0;
    let longTaskMs = 0;
    let drawSum = 0,
      triangleSum = 0,
      maxDraws = 0,
      measured = 0;
    const prior = gl.info.autoReset;
    gl.info.autoReset = false;
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
        scene.traverse((object) => {
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
              visibleSources: batch.sources.filter((source) => source.visible).length,
              detachedSources: batch.sources.filter((source) => !source.parent).length,
            });
        });
        const renderer = rendererMetadata(gl);
        window.dispatchEvent(
          new CustomEvent("graphics-sample", {
            detail: {
              ...metrics.summary(),
              elapsed: (now - start) / 1000,
              complete: now - start >= 65000,
              draws: measured ? drawSum / measured : 0,
              maxDraws,
              triangles: measured ? triangleSum / measured : 0,
              geometries: gl.info.memory.geometries,
              textures: gl.info.memory.textures,
              programs: gl.info.programs?.length ?? null,
              materials: census.materials,
              staticBatches,
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
              width: gl.domElement.width,
              height: gl.domElement.height,
              dpr: gl.getPixelRatio(),
              scenario: benchmarkMetadata(),
              browser: browserMetadata(),
              hardware: hardwareMetadata(renderer),
              backend: {
                kind: renderer.kind,
                renderer: renderer.renderer,
                contextVersion: renderer.contextVersion,
                gpuRenderer: renderer.gpuRenderer,
                gpuVendor: renderer.gpuVendor,
              },
            },
          }),
        );
      }
      last = now;
      gl.info.reset();
    });
    return () => {
      stop();
      observer?.disconnect();
      gl.info.autoReset = prior;
    };
  }, [gl, scene]);
  return null;
}
