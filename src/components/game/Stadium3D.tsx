import { RuntimeBudget } from "@/components/game/RuntimeBudget";
import { PausedCameraFrames } from "./stadium/match/PausedCameraFrames";
import { FpsMeter } from "./stadium/match/PerformanceHud";
import type { Quality, FpsSample } from "./stadium/match/PerformanceHud";
export type { Quality } from "./stadium/match/PerformanceHud";
import {
  QualityPressure,
  RuntimeSceneBudgetContext,
} from "@/components/game/runtime-budget-context";
import { GRAPHICS_PROFILES } from "@/game/contracts/graphics-profile";
import { resolveRuntimeSceneBudget } from "@/game/runtime-scene-budget";

import { Canvas } from "@react-three/fiber";

import { memo, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import * as THREE from "three";

import { FirstMatchFrame } from "@/components/game/FirstMatchFrame";
import { CanvasLifecycle } from "./CanvasLifecycle";
import { GraphicsBoundary } from "@/components/game/GraphicsBoundary";
import { useAccessibility } from "@/hooks/useAccessibility";
import { accessibleMatchCamera } from "@/game/camera-motion-policy";

import { createWebGPURenderer, detectWebGPU, type GpuBackend } from "@/components/game/renderer";

import { dprFor } from "@/game/device";
import { matchGpuQuality, webglRendererName } from "@/game/gpu-quality";
import { type CameraMode } from "@/game/camera-modes";

import type { SupporterMatchday } from "@/game/career-world-types";

import { FIELD_Z } from "@/game/sim-rules";
import { type SimView } from "@/game/sim-types";
import type { PlayerLook } from "@/game/player-model";

import { matchLook } from "@/game/matchday";

import { useResolvedVisual } from "@/game/visual-settings";
import { Ktx2CanvasAssets as CompressedTextures } from "./Ktx2CanvasAssets";

export type { CameraMode } from "@/game/camera-modes";
import { Scene } from "./stadium/match/MatchScene";
const SHADOW_SETTINGS = { type: THREE.PCFShadowMap };
const SurfaceAudit = lazy(() => import("./stadium/match/SurfaceAudit"));

function Stadium3DImpl({
  sim,
  mode,
  quality: deviceQuality,
  pixelRatio,
  supporters,
  paused = false,
  onFirstFrame,
  lookOverrides,
}: {
  sim: SimView;
  mode: CameraMode;
  quality: Quality;
  pixelRatio?: number;
  paused?: boolean;
  supporters?: SupporterMatchday | undefined;
  onFirstFrame?: (() => void) | undefined;
  lookOverrides?: ReadonlyMap<string, PlayerLook> | undefined;
}) {
  const { reducedMotion } = useAccessibility();
  const effectiveMode = accessibleMatchCamera(mode, reducedMotion);
  const vis = useResolvedVisual(sim.home.clubId);
  const startedAt = useRef(performance.now());
  const [gpuName, setGpuName] = useState("");
  // Escolha do jogador em /visual manda; "auto" segue a detecção do aparelho.
  // Cinema usa a geometria alta e amplia seletivamente resolução/efeitos sem
  // duplicar toda a árvore 3D nem quebrar configurações antigas.
  const quality: Quality = matchGpuQuality(vis.quality, deviceQuality, gpuName);
  const baseLook = useMemo(
    () => matchLook(sim.home.clubId, sim.away.clubId),
    [sim.home.clubId, sim.away.clubId],
  );
  // o clima físico manda no visual: chuva do sim molha a cena, calor seca.
  // Com céu limpo, vale o visual do clube/jogador. O vento é sempre o da
  // partida (bandeiras, grama e chuva inclinada acompanham a física).
  const simWeather = sim.weather;
  const simWind = sim.wind?.strength01;
  const look = useMemo(() => {
    const live = { ...baseLook, wind: simWind ?? baseLook.wind };
    if (simWeather === "rain")
      return { ...live, weather: "chuva" as const, wet: Math.max(live.wet, 0.75) };
    if (simWeather === "heat")
      return { ...live, weather: "seco" as const, wet: Math.min(live.wet, 0.15) };
    return live;
  }, [baseLook, simWeather, simWind]);

  // Em segundo plano o desenho 3D é suspenso para poupar bateria no celular.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /**
   * Qualidade adaptativa: mede o ritmo real dos quadros e desce um degrau
   * (resolução, pós-processamento e torcida antes de tudo) quando a partida
   * fica pesada; volta a subir só depois de um bom tempo estável.
   */
  const eff = quality;
  const [pressure, setPressure] = useState(0);
  const [fps, setFps] = useState<FpsSample | null>(null);
  const sceneTier = vis.quality === "cinema" ? "cinema" : quality;
  const sceneBudget = useMemo(
    () => resolveRuntimeSceneBudget(sceneTier, pressure),
    [sceneTier, pressure],
  );

  const declines = useRef(0);
  const inclines = useRef(0);

  // Sombras: preferência explícita do jogador vence a decisão automática.
  const shadowsOn = vis.shadows === "auto" ? eff === "alta" : vis.shadows === "ligadas";
  // Escala de resolução escolhida em /visual, aplicada sobre o limite do aparelho.
  const dpr = useMemo(() => {
    const base = dprFor(eff);
    const s = vis.resolutionScale * sceneBudget.resolutionScale;
    const cap = GRAPHICS_PROFILES[sceneTier].maxPixelRatio;
    return Array.isArray(base)
      ? ([Math.min(cap, base[0] * s), Math.min(cap, base[1] * s)] as [number, number])
      : Math.min(cap, base * s);
  }, [eff, vis.resolutionScale, sceneBudget.resolutionScale, sceneTier]);

  // Backend gráfico: WebGPU quando o aparelho suporta, senão WebGL2.
  // A detecção acontece uma vez, antes de montar o palco, para não recriar
  // o contexto (e perder todas as texturas) no meio da partida.
  const [backend, setBackend] = useState<GpuBackend | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void detectWebGPU().then((ok) => {
      if (alive) setBackend(ok ? "webgpu" : "webgl2");
    });
    return () => {
      alive = false;
    };
  }, []);

  const glProp = useMemo(() => {
    const base = {
      antialias: eff === "media",
      powerPreference: "high-performance" as const,
      stencil: false,
    };
    if (backend !== "webgpu") return base;
    return async (props: Record<string, unknown>) => {
      const renderer = await createWebGPURenderer({ ...props, ...base }, () =>
        setBackend("webgl2"),
      );

      if (renderer) return renderer as never;
      // Adaptador sumiu entre a detecção e a criação: volta para WebGL2.
      setBackend("webgl2");
      const { WebGLRenderer } = THREE;
      return new WebGLRenderer({ ...(props as object), ...base }) as never;
    };
  }, [backend, eff]);

  if (!backend)
    return (
      <div
        role="status"
        className="flex h-full min-h-64 w-full items-center justify-center gap-3 bg-background text-sm text-muted-foreground"
      >
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        Preparando o estádio 3D…
      </div>
    );

  return (
    <div
      className="relative h-full w-full"
      data-supporter-climate={supporters?.climate}
      data-supporter-occupancy={supporters?.occupancy.toFixed(3)}
      data-render-quality={quality}
      data-camera-mode={effectiveMode}
      data-camera-motion={reducedMotion ? "reduced" : "full"}
    >
      <GraphicsBoundary>
        <Canvas
          key={backend}
          shadows={shadowsOn ? SHADOW_SETTINGS : false}
          frameloop={visible && !paused ? "always" : "demand"}
          dpr={
            pixelRatio === undefined
              ? dpr
              : Math.min(GRAPHICS_PROFILES[quality].maxPixelRatio, Math.max(0.6, pixelRatio))
          }
          camera={{ position: [0, 46, FIELD_Z + 44], fov: 42 }}
          gl={glProp}
          performance={{ min: 0.5 }}
          fallback={
            <div
              role={rendererReady ? undefined : "status"}
              aria-hidden={rendererReady || undefined}
              className="flex h-full min-h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground"
            >
              Não foi possível iniciar os gráficos 3D. Os controles e o placar continuam
              disponíveis.
            </div>
          }
          onCreated={({ gl }) => {
            setRendererReady(true);
            setGpuName(webglRendererName(gl));
            const r = gl as unknown as {
              toneMapping: THREE.ToneMapping;
              toneMappingExposure: number;
              outputColorSpace: string;
              shadowMap?: { type?: THREE.ShadowMapType };
              capabilities?: { getMaxAnisotropy?: () => number };
            };
            r.toneMapping = THREE.ACESFilmicToneMapping;
            r.toneMappingExposure =
              look.time === "dia" ? 0.9 : look.time === "entardecer" ? 1.0 : 1.1;
            r.outputColorSpace = THREE.SRGBColorSpace;
            // borda de sombra suave só na qualidade alta: o filtro extra custa
            // pouco lá e é o que mais aproxima a imagem de uma transmissão
            if (r.shadowMap) r.shadowMap.type = THREE.PCFShadowMap;
            // Texturas nítidas em ângulos rasantes (linhas do campo, publicidade,
            // faixas de corte) — o custo é baixo e o ganho de definição é grande.
            const maxAniso = r.capabilities?.getMaxAnisotropy?.() ?? 16;
            THREE.Texture.DEFAULT_ANISOTROPY = Math.min(
              Math.max(
                1,
                Math.round(
                  (eff === "alta" ? 16 : eff === "media" ? 8 : 4) * sceneBudget.textureScale,
                ),
              ),
              maxAniso,
            );
          }}
        >
          <CanvasLifecycle onStatus={(status) => setRendererReady(status === "ready")} />
          <FirstMatchFrame
            startedAt={startedAt.current}
            quality={quality}
            backend={backend}
            onFirstFrame={onFirstFrame}
          />
          <PausedCameraFrames paused={paused} visible={visible} mode={effectiveMode} />
          {typeof location !== "undefined" &&
          location.pathname.endsWith("/mobile-match.html") &&
          new URLSearchParams(location.search).has("inspect") ? (
            <Suspense fallback={null}>
              <SurfaceAudit />
            </Suspense>
          ) : null}
          <CompressedTextures enabled={quality !== "baixa"} />
          <RuntimeBudget
            tier={sceneTier}
            enabled={vis.adaptive}
            suspended={paused}
            onChange={setPressure}
          />
          <QualityPressure.Provider value={pressure}>
            <RuntimeSceneBudgetContext.Provider value={sceneBudget}>
              <Scene
                sim={sim}
                mode={effectiveMode}
                quality={eff}
                look={look}
                shadows={shadowsOn}
                backend={backend}
                postIntensity={vis.postIntensity * (vis.quality === "cinema" ? 1.12 : 1)}
                supporters={supporters}
                adaptive={vis.adaptive}
                lookOverrides={lookOverrides}
                reducedMotion={reducedMotion}
              />
            </RuntimeSceneBudgetContext.Provider>
          </QualityPressure.Provider>
          {vis.showFps && !paused ? (
            <FpsMeter onSample={setFps} backend={backend} quality={eff} />
          ) : null}
        </Canvas>
      </GraphicsBoundary>
      {vis.showFps && fps ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-1 font-mono text-[10px] leading-tight text-white/85">
          <span className="text-white">{Math.round(fps.fps)} fps</span>
          <span className="ml-2 text-white/60">med {Math.round(fps.avg)}</span>
          <span className="ml-2 text-white/60">p95 {fps.p95FrameMs.toFixed(1)} ms</span>
          <span className="ml-2 text-white/60">1% {Math.round(fps.onePercentLow)}</span>
          <span className="ml-2 text-white/60">{fps.frameMs.toFixed(1)} ms</span>
          <span className="ml-2 uppercase text-white/60">{fps.backend}</span>
          <span className="ml-2 text-white/60">{fps.triangles.toLocaleString("pt-BR")} tri</span>
          <span className="ml-2 text-white/60">{fps.drawCalls} draws</span>
          {fps.memoryMb ? <span className="ml-2 text-white/60">{fps.memoryMb} MB</span> : null}
        </div>
      ) : null}
      {quality === "baixa" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.42) 100%)",
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Memoizado: o HUD da partida re-renderiza várias vezes por segundo e não deve
 * reconstruir a árvore 3D. Só mudanças reais de sim/câmera/qualidade renderizam.
 */
export const Stadium3D = memo(Stadium3DImpl);
