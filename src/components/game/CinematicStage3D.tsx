import { preloadCinematicSet } from "./cinematic/sets/registry";
// ============================================================================
//  CinematicStage3D.tsx
//  Cenários 3D reais das cenas cinematográficas: vestiário, túnel, entrada em
//  campo, coletiva, arquibancada e sala da diretoria.
//
//  Cada cena tem geometria própria, luz prática (lâmpadas, refletores, flashes),
//  névoa, figurantes articulados e um "diretor de câmera" que corta a cada fala
//  e faz um travelling contínuo dentro da fala.
// ============================================================================

import { Canvas } from "@react-three/fiber";
import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

import type { Cutscene, SceneArt, Speaker } from "@/content/cutscenes";
import type { LineLight, ShotSize } from "@/game/cutscene-director";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { CinematicManner } from "@/game/cinematic-actor";
import type { CinematicVoiceClockRef } from "@/game/cutscene-visemes";
import { supportsWebGL } from "@/game/webgl-support";
import { cinematicSetFor } from "@/game/cinematic-blocking";

import type { CinematicCue } from "@/game/cinematic-cue";

import { CinematicRuntime } from "./cinematic/CinematicRuntime";
import { CinematicFrameProbe } from "./cinematic/CinematicFrameProbe";
import type { CinematicBatchSnapshot } from "./cinematic/CinematicSetBatch";
import { GraphicsBoundary } from "./GraphicsBoundary";
import { Ktx2CanvasAssets } from "./Ktx2CanvasAssets";

import {
  cinematicPresentationBudget,
  CinematicPressureController,
  cinematicGpuQuality,
  cinematicInitialQuality,
} from "@/game/cinematic-performance";
const CinematicLens = lazy(() => import("./cinematic/CinematicLens"));
import { detectQuality, type QualityLevel } from "@/game/device";
import { useT } from "@/i18n/provider";

import { CinematicScene } from "./cinematic/CinematicScene";
export const CinematicStage3D = memo(function CinematicStage3D({
  business,
  language,
  art,
  primary,
  secondary,
  beat = 0,
  mood = "neutral",
  intensity = 0,
  speaker = null,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
  light = "neutra",
  paused = false,
  reduced = false,
  look,
  cast,
  onUnavailable,
  qualityMode = "auto",
  manner,
  onVisible,
  onReady,
  previewTime,
  cue,
  voiceClockRef,
  voicePlayingRef,
}: {
  business?: Cutscene["business"];
  language?: string | undefined;
  art: SceneArt;
  primary: string;
  secondary: string;
  beat?: number;
  mood?: "good" | "bad" | "neutral";
  /** tensão da fala atual (0..1): tremor de mão e aperto de lente */
  intensity?: number;
  /** quem fala agora (o figurante-herói gesticula) */
  speaker?: Speaker | null;
  /** gramática da direção: tamanho do plano, travelling e clímax da fala */
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  light?: LineLight;
  paused?: boolean;
  reduced?: boolean;
  look?: ManagerLook | undefined;
  cast?: Cast | undefined;
  onUnavailable?: (() => void) | undefined;
  qualityMode?: QualityLevel | "auto";
  manner?: CinematicManner | undefined;
  onVisible?: (() => void) | undefined;
  onReady?: (() => void) | undefined;
  previewTime?: number | undefined;
  cue?: CinematicCue | undefined;
  voiceClockRef?: CinematicVoiceClockRef | undefined;
  voicePlayingRef?: { current: boolean } | undefined;
}) {
  const kind = cinematicSetFor(art);
  const webglAvailable = useMemo(() => supportsWebGL(), []);
  const initialQuality = useMemo(() => detectQuality(), []);
  const [quality, setQuality] = useState<QualityLevel>(() =>
    cinematicInitialQuality(initialQuality, qualityMode),
  );
  const pressure = useRef(new CinematicPressureController());
  const [pressureStage, setPressureStage] = useState(0);
  const presentation = cinematicPresentationBudget(quality, pressureStage);
  const samplePerformance = useCallback(
    (fps: number, p95: number) => {
      if (qualityMode === "auto") setPressureStage(pressure.current.sample(fps, p95));
    },
    [qualityMode],
  );
  const previousQualityMode = useRef(qualityMode);
  const rendererName = useRef<string | undefined>(undefined);
  const contextListenerCleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (previousQualityMode.current === qualityMode) return;
    previousQualityMode.current = qualityMode;
    pressure.current = new CinematicPressureController();
    setPressureStage(0);
    const next = cinematicInitialQuality(initialQuality, qualityMode);
    setQuality(
      qualityMode === "auto" && rendererName.current
        ? cinematicGpuQuality(next, rendererName.current)
        : next,
    );
  }, [qualityMode, initialQuality]);
  // Begin the selected environment while the canvas is still initializing.
  useEffect(() => {
    void preloadCinematicSet(kind).catch(() => undefined);
  }, [kind]);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const stageReady = useCallback(() => {
    setReady(true);
    onReady?.();
  }, [onReady]);
  const enhancedAllowed =
    ready && !reduced && presentation.lens !== "off" && quality !== "baixa" && !contextLost;
  const showEnhanced = enhanced && enhancedAllowed;
  useEffect(() => {
    if (!enhancedAllowed) {
      setEnhanced(false);
      return;
    }
    // Demand rendering already sleeps when paused/hidden. Keep the warmed
    // environment and composer alive instead of reallocating them on resume.
    if (enhanced || paused || hidden) return;
    const timer = window.setTimeout(() => startTransition(() => setEnhanced(true)), 200);
    return () => window.clearTimeout(timer);
  }, [enhancedAllowed, enhanced, paused, hidden]);
  const host = useRef<HTMLDivElement>(null);
  const openedAt = useRef(performance.now());
  const onBatch = useCallback(({ sources, batches, visibleSources }: CinematicBatchSnapshot) => {
    if (!host.current) return;
    host.current.dataset["staticSources"] = String(sources);
    host.current.dataset["staticBatches"] = String(batches);
    host.current.dataset["staticVisibleSources"] = String(visibleSources);
  }, []);
  useEffect(() => {
    const changed = () => setHidden(document.hidden);
    changed();
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(
    () => () => {
      contextListenerCleanup.current?.();
      contextListenerCleanup.current = null;
    },
    [],
  );
  const retryContext = useCallback(() => {
    pressure.current = new CinematicPressureController();
    setPressureStage(0);
    setReady(false);
    setEnhanced(false);
    setContextLost(false);
    setCanvasGeneration((generation) => generation + 1);
  }, []);
  return (
    <div
      ref={host}
      className="absolute inset-0"
      data-cinematic-set={kind}
      data-cinematic-quality={quality}
      data-cinematic-pressure={pressureStage}
    >
      <GraphicsBoundary
        fallback={
          <button
            type="button"
            onClick={onUnavailable}
            className="absolute inset-0 z-10 bg-background p-8 text-white"
          >
            A cena 3D não carregou. Abrir cena ilustrada.
          </button>
        }
      >
        {webglAvailable && !contextLost ? (
          <Canvas
            key={canvasGeneration}
            frameloop={paused || reduced || hidden ? "demand" : "always"}
            shadows={quality === "baixa" ? false : { type: THREE.PCFShadowMap }}
            dpr={
              quality === "alta"
                ? [0.9 * presentation.resolutionScale, 1.25 * presentation.resolutionScale]
                : quality === "media"
                  ? [0.75 * presentation.resolutionScale, presentation.resolutionScale]
                  : 0.7 * presentation.resolutionScale
            }
            camera={{ position: [0, 2.2, 6.5], fov: 42, near: 0.05, far: 90 }}
            gl={{
              // The offscreen cinematic composer owns SMAA. Canvas MSAA is
              // discarded by that path and only allocates a redundant buffer.
              antialias: false,
              powerPreference: "high-performance",
              stencil: false,
            }}
            onCreated={({ gl }) => {
              contextListenerCleanup.current?.();
              const onContextLost = (event: Event) => {
                // Prevent the browser's default reload path, then let the
                // cutscene fall back to its already-mounted illustrated scene.
                event.preventDefault();
                contextListenerCleanup.current?.();
                contextListenerCleanup.current = null;
                setEnhanced(false);
                setReady(false);
                setContextLost(true);
                onUnavailable?.();
              };
              gl.domElement.addEventListener("webglcontextlost", onContextLost, false);
              contextListenerCleanup.current = () =>
                gl.domElement.removeEventListener("webglcontextlost", onContextLost, false);
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.shadowMap.type = THREE.PCFShadowMap;

              const context = gl.getContext();
              const debug = context.getExtension("WEBGL_debug_renderer_info");
              if (debug) {
                const renderer = String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL));
                rendererName.current = renderer;
                if (host.current) host.current.dataset["cinematicGpu"] = renderer;
                if (qualityMode === "auto") {
                  setQuality(cinematicGpuQuality(quality, renderer));
                }
              }
            }}
          >
            <Ktx2CanvasAssets enabled={quality !== "baixa"} />
            <CinematicRuntime
              quality={quality}
              look={look}
              cast={cast}
              stopped={paused || hidden}
              reduced={reduced}
              manner={manner}
              previewTime={previewTime}
              cue={cue}
              voiceClockRef={voiceClockRef}
              voicePlayingRef={voicePlayingRef}
            >
              <CinematicFrameProbe
                host={host}
                openedAt={openedAt.current}
                stopped={paused || reduced || hidden}
                onVisible={onVisible}
                onReady={stageReady}
                onSample={samplePerformance}
              />
              <CinematicScene
                business={business}
                language={language}
                kind={kind}
                art={art}
                beat={beat}
                primary={primary}
                secondary={secondary}
                mood={mood}
                quality={quality}
                intensity={intensity}
                speaker={speaker}
                size={size}
                dollyFrom={dollyFrom}
                dollyTo={dollyTo}
                climax={climax}
                light={light}
                festive={(art === "trophy" || art === "celebration") && mood === "good"}
                onBatch={onBatch}
                enhanced={showEnhanced}
                onUnavailable={onUnavailable}
              />
              {showEnhanced ? (
                <Suspense fallback={null}>
                  <CinematicLens
                    quality={presentation.lens === "off" ? "baixa" : presentation.lens}
                    intensity={intensity}
                    climax={climax}
                    mood={mood}
                  />
                </Suspense>
              ) : null}
            </CinematicRuntime>
          </Canvas>
        ) : (
          <button
            type="button"
            onClick={contextLost ? retryContext : onUnavailable}
            className="absolute inset-0 z-10 bg-background p-8 text-white"
          >
            {contextLost
              ? "A cena 3D perdeu o contexto. Tentar novamente."
              : "O 3D está indisponível neste navegador. Abrir cena ilustrada."}
          </button>
        )}
      </GraphicsBoundary>
    </div>
  );
});
