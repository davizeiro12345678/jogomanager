import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { FrameMetrics } from "@/game/frame-metrics";

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
  requested: { scenario: string | null; seed: string | null; quality: string | null; camera: string | null };
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
  } | null;
};

type BenchmarkNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: { mobile?: boolean; platform?: string };
};

function benchmarkMetadata(): GraphicsBenchmarkMetadata | null {
  const value = (window as Window & { __PFM_GRAPHICS_BENCHMARK__?: unknown }).__PFM_GRAPHICS_BENCHMARK__;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GraphicsBenchmarkMetadata>;
  return typeof candidate.id === "string" && typeof candidate.seed === "string" ? candidate as GraphicsBenchmarkMetadata : null;
}

function rendererMetadata(gl: unknown) {
  const renderer = gl as BenchmarkRenderer;
  const name = renderer.constructor?.name ?? "unknown";
  const isWebGpu = renderer.isWebGPURenderer === true || /webgpu/i.test(name);
  const isWebGl2 = !isWebGpu && (renderer.capabilities?.isWebGL2 === true || /webgl2/i.test(name));
  let contextVersion: string | null = null;
  try {
    const context = renderer.getContext?.();
    if (context?.getParameter && typeof context.VERSION === "number") {
      const value = context.getParameter(context.VERSION);
      contextVersion = typeof value === "string" ? value : null;
    }
  } catch {
    // WebGPU renderers and privacy-hardened browsers may not expose a WebGL context.
  }
  return {
    kind: isWebGpu ? "webgpu" : isWebGl2 ? "webgl2" : renderer.isWebGLRenderer ? "webgl" : "unknown",
    renderer: name,
    contextVersion,
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
        const renderer = rendererMetadata(gl);
        window.dispatchEvent(new CustomEvent("graphics-sample", { detail: {
          ...metrics.summary(), elapsed: (now - start) / 1000, complete: now - start >= 65000,
          draws: measured ? drawSum / measured : 0, maxDraws,
          triangles: measured ? triangleSum / measured : 0,
          geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
          programs: gl.info.programs?.length ?? null, materials: materials.size,
          firstFrameMs: firstFrame, longTasks: observer ? longTasks : null,
          longTaskMs: observer ? longTaskMs : null,
          width: gl.domElement.width, height: gl.domElement.height, dpr: gl.getPixelRatio(),
          scenario: benchmarkMetadata(),
          browser: browserMetadata(),
          hardware: hardwareMetadata(renderer),
          backend: {
            kind: renderer.kind,
            renderer: renderer.renderer,
            contextVersion: renderer.contextVersion,
          },
        } }));
      }
      last = now;
      gl.info.reset();
    });
    return () => { stop(); observer?.disconnect(); gl.info.autoReset = prior; };
  }, [gl, scene]);
  return null;
}
