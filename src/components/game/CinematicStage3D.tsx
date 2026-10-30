// ============================================================================
//  CinematicStage3D.tsx
//  Cenários 3D reais das cenas cinematográficas: vestiário, túnel, entrada em
//  campo, coletiva, arquibancada e sala da diretoria.
//
//  Cada cena tem geometria própria, luz prática (lâmpadas, refletores, flashes),
//  névoa, figurantes articulados e um "diretor de câmera" que corta a cada fala
//  e faz um travelling contínuo dentro da fala.
// ============================================================================

import { Environment, Lightformer } from "@react-three/drei";
import { CinematicDirector as Director } from "./CinematicDirector";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  lazy,
  memo,
  startTransition,
  Suspense,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as THREE from "three";

import type { Cutscene, SceneArt, Speaker } from "@/content/cutscenes";
import type { LineLight, ShotSize } from "@/game/cutscene-director";
import type { Cast } from "@/game/cast";
import type { ManagerLook } from "@/game/types";
import type { CinematicManner } from "@/game/cinematic-actor";
import type { CinematicVoiceClockRef } from "@/game/cutscene-visemes";
import { supportsWebGL } from "@/game/webgl-support";
import {
  cinematicSetFor,
  cinematicStageActorFor,
  type CinematicSet,
} from "@/game/cinematic-blocking";
import { hashSeed } from "@/game/rng";

import type { CinematicCue } from "@/game/cinematic-cue";
import { CinematicAtmosphere } from "./cinematic/CinematicAtmosphere";

import { CinematicSpecialSet } from "./cinematic/CinematicSpecialSet";
import { CinematicPortraitLight } from "./cinematic/CinematicPortraitLight";
import { CinematicActor as Figure } from "./cinematic/CinematicActor";
import { CinematicRuntime } from "./cinematic/CinematicRuntime";
import { CinematicFrameProbe } from "./cinematic/CinematicFrameProbe";
import { CinematicSetBatch, type CinematicBatchSnapshot } from "./cinematic/CinematicSetBatch";
import { GraphicsBoundary } from "./GraphicsBoundary";
import { Ktx2CanvasAssets } from "./Ktx2CanvasAssets";

import { CinematicSetFinish } from "./cinematic/CinematicSetFinish";
import { CinematicStoryDressing } from "./cinematic/CinematicStoryDressing";
import { CinematicBusinessDressing } from "./cinematic/CinematicBusinessDressing";
import { CinematicMotivatedLight } from "./cinematic/CinematicMotivatedLight";
import { resolveCinematicSetLoader } from "./cinematic/sets/registry";

import {
  cinematicPresentationBudget,
  CinematicPressureController,
  cinematicGpuQuality,
  cinematicInitialQuality,
} from "@/game/cinematic-performance";
const CinematicLens = lazy(() => import("./cinematic/CinematicLens"));
import { detectQuality, type QualityLevel } from "@/game/device";
import { useT } from "@/i18n/provider";

type SetKind = CinematicSet;

class CinematicSetErrorBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onUnavailable();
  }

  override render() {
    return this.state.failed ? <group /> : this.props.children;
  }
}

/** Editing cuts establish geography before a face; cameras never fly through actors. */
/** Luz da fala vinda da direção: o humor pinta o cenário a cada fala. */
const LINE_TINT: Record<LineLight, { sky: string; rim: string; amb: number }> = {
  neutra: { sky: "#effff4", rim: "#ffffff", amb: 1 },
  quente: { sky: "#ffe3c0", rim: "#ffb46a", amb: 1.1 },
  fria: { sky: "#c3d9ff", rim: "#7fa8ff", amb: 0.95 },
  dramatica: { sky: "#d8c9ff", rim: "#ff4d5e", amb: 0.8 },
  festa: { sky: "#fff3d6", rim: "#ffe066", amb: 1.25 },
};

/** The set's Suspense boundary has resolved and its meshes have committed. */
function SetMounted({ ready }: { ready: RefObject<boolean> }) {
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    ready.current = true;
    invalidate();
    return () => {
      ready.current = false;
    };
  }, [ready, invalidate]);
  return null;
}

function Stage({
  business,
  language,
  kind,
  art,
  beat,
  primary,
  secondary,
  mood,
  quality,
  intensity = 0,
  speaker = null,
  size = "medio",
  dollyFrom = 0,
  dollyTo = 0,
  climax = false,
  light = "neutra",
  festive = false,
  enhanced = true,
  onBatch,
  onUnavailable,
  setReady,
}: {
  business?: Cutscene["business"];
  language?: string | undefined;
  kind: SetKind;
  art: SceneArt;
  beat: number;
  primary: string;
  secondary: string;
  mood: "good" | "bad" | "neutral";
  quality: QualityLevel;
  intensity?: number;
  speaker?: Speaker | null;
  size?: ShotSize;
  dollyFrom?: number;
  dollyTo?: number;
  climax?: boolean;
  light?: LineLight;
  festive?: boolean;
  enhanced?: boolean;
  onBatch?: ((snapshot: CinematicBatchSnapshot) => void) | undefined;
  onUnavailable?: (() => void) | undefined;
  setReady: RefObject<boolean>;
}) {
  const { t } = useT();
  const SelectedSet = useMemo(() => {
    const loader = resolveCinematicSetLoader(kind);
    return loader ? lazy(loader) : null;
  }, [kind]);
  useEffect(() => {
    if (!SelectedSet) onUnavailable?.();
  }, [SelectedSet, onUnavailable]);
  const base = mood === "good" ? "#fff3e1" : mood === "bad" ? "#d8e3fa" : "#eef2f7";
  const tint = LINE_TINT[light];
  const warm = light === "neutra" ? base : tint.sky;
  const indoor = kind === "locker" || kind === "press" || kind === "office" || kind === "tunnel";
  const amb = (indoor ? 0.34 : 0.5) * tint.amb;
  // Existing fixtures retain their own detailed rigs. Every other authored
  // speaker receives one semantic overlay, shared by the camera resolver.
  const stagedActor = cinematicStageActorFor(art, speaker, festive);
  const residentSpeaker = stagedActor?.presence === "resident" ? stagedActor.role : null;
  const setScene = SelectedSet ? (
    <Suspense fallback={<group />}>
      <SelectedSet
        primary={primary}
        secondary={secondary}
        speaker={residentSpeaker}
        festive={festive}
        training={art === "training"}
      />
      <SetMounted ready={setReady} />
    </Suspense>
  ) : (
    <group />
  );
  return (
    <>
      <color
        attach="background"
        args={[art === "training" ? "#83a8ba" : indoor ? "#0b1017" : "#101b29"]}
      />
      <fog
        attach="fog"
        args={[
          art === "training" ? "#83a8ba" : indoor ? "#0b1017" : "#0a1310",
          indoor ? 8 : 22,
          indoor ? 34 : 70,
        ]}
      />
      <ambientLight intensity={amb} color={warm} />
      <hemisphereLight intensity={indoor ? 0.4 : 0.45} color="#dce8f4" groundColor="#30333a" />
      {indoor ? (
        <>
          <directionalLight position={[0, 2.5, 6]} intensity={0.38} color="#e8f0f7" />
          <directionalLight
            position={[-4, 3, -4]}
            intensity={kind === "press" ? 0.9 : 0.45}
            color="#d4e3ff"
          />
        </>
      ) : null}
      <directionalLight
        castShadow
        position={[5, 11, 6]}
        intensity={indoor ? 1.55 : 2.6}
        color={light === "neutra" ? "#fff8f2" : warm}
        shadow-mapSize={quality === "alta" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-camera-left={indoor ? -12 : -24}
        shadow-camera-right={indoor ? 12 : 24}
        shadow-camera-top={indoor ? 10 : 22}
        shadow-camera-bottom={indoor ? -10 : -22}
      />
      {/* Neutral rim preserves the complexion; club colour stays in the set. */}
      <spotLight
        position={[-5, 6, -5]}
        angle={0.7}
        penumbra={0.9}
        intensity={indoor ? 12 : 22}
        color={light === "neutra" ? "#d4e6ff" : tint.rim}
      />
      <CinematicMotivatedLight kind={kind} art={art} mood={mood} light={light} quality={quality} />
      {enhanced && quality !== "baixa" && (
        <Environment resolution={quality === "alta" ? 96 : 64} frames={1}>
          <Lightformer position={[0, 6, 2]} scale={[10, 3, 1]} intensity={2.2} color={warm} />
          <Lightformer position={[-6, 3, -4]} scale={[6, 4, 1]} intensity={1.1} color="#d6e5f4" />
          <Lightformer position={[6, 3, -4]} scale={[6, 4, 1]} intensity={0.8} color="#e6dfd3" />
        </Environment>
      )}
      <Director
        business={business}
        kind={kind}
        art={art}
        beat={beat}
        intensity={intensity}
        size={size}
        dollyFrom={dollyFrom}
        dollyTo={dollyTo}
        climax={climax}
        speaker={speaker}
        festive={festive}
      />
      <CinematicAtmosphere kind={kind} art={art} mood={mood} quality={quality} />
      <CinematicPortraitLight />
      <CinematicSetBatch
        key={`${art}-${kind}-${primary}-${secondary}-${quality}-${t("cinemaStudio.title")}`}
        onReady={onBatch}
      >
        {art !== "medical" && art !== "gym" && <CinematicSetFinish kind={kind} primary={primary} />}
        {business ? (
          <CinematicBusinessDressing
            business={business}
            primary={primary}
            secondary={secondary}
            quality={quality}
            language={language ?? "pt-BR"}
          />
        ) : null}
        <CinematicStoryDressing
          kind={kind}
          art={art}
          primary={primary}
          secondary={secondary}
          quality={quality}
        />
        {art === "medical" || art === "gym" ? (
          <CinematicSpecialSet
            medical={art === "medical"}
            primary={primary}
            speaker={residentSpeaker}
          />
        ) : null}
        {onUnavailable ? (
          <CinematicSetErrorBoundary key={kind} onUnavailable={onUnavailable}>
            {setScene}
          </CinematicSetErrorBoundary>
        ) : (
          setScene
        )}
        {stagedActor?.presence === "overlay" ? (
          <Figure
            key={`speaker-${art}-${stagedActor.role}`}
            x={stagedActor.mark[0]}
            z={stagedActor.mark[1]}
            color={
              stagedActor.role === "captain" || stagedActor.role === "fan"
                ? primary
                : stagedActor.role === "referee"
                  ? "#222d36"
                  : secondary
            }
            shorts="#19232b"
            seed={hashSeed(`cinematic-speaker:${stagedActor.role}`)}
            role={stagedActor.role}
            costume={
              stagedActor.role === "captain" || stagedActor.role === "fan" ? "player" : "staff"
            }
            clipboard={
              stagedActor.role === "assistant" ||
              stagedActor.role === "doctor" ||
              stagedActor.role === "scout"
            }
            acting
          />
        ) : null}
      </CinematicSetBatch>
    </>
  );
}

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
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const setMounted = useRef(false);
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
    // Keep the warm environment and lens during pause/background; the demand
    // frame loop already sleeps and resume must not rebuild the composer.
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
    setMounted.current = false;
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
            style={{ opacity: ready ? 1 : 0 }}
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
              antialias: quality !== "baixa",
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
                setReady={setMounted}
                onVisible={onVisible}
                onReady={stageReady}
                onSample={samplePerformance}
              />
              <Stage
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
                setReady={setMounted}
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
