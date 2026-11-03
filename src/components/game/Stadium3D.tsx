import { RuntimeBudget } from "@/components/game/RuntimeBudget";
import { MobileFramebufferBudget } from "./MobileFramebufferBudget";
import {
  QualityPressure,
  RuntimeSceneBudgetContext,
  useQualityPressure,
  useRuntimeSceneBudget,
} from "@/components/game/runtime-budget-context";
import { GRAPHICS_PROFILES } from "@/game/contracts/graphics-profile";
import { resolveRuntimeSceneBudget } from "@/game/runtime-scene-budget";

import { broadcastInterest, ShotHold } from "@/game/broadcast-interest";

import { FrameMetrics } from "@/game/frame-metrics";
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import type React from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { FirstMatchFrame } from "@/components/game/FirstMatchFrame";
import { FrameProbe } from "@/components/game/FrameProbe";
import { GraphicsBoundary } from "@/components/game/GraphicsBoundary";
import { MatchPlayers } from "@/components/game/players/MatchPlayers";
import { OfficialRig } from "@/components/game/players/OfficialRig";
import { rendererMetadata } from "@/game/graphics-renderer-metadata";
import { CanvasLifecycle } from "./CanvasLifecycle";
import { Ktx2CanvasAssets } from "./Ktx2CanvasAssets";
import { subscribeRenderedFrames } from "./graphics-probe";
import { onTurfDetailReady } from "./stadium/textures/turf-detail";

import { PostFX } from "@/components/game/post/LazyPostFX";
import { createWebGPURenderer, detectWebGPU, type GpuBackend } from "@/components/game/renderer";

import { skyTexture } from "@/components/game/stadium/textures/sky";

import { StadiumProps } from "@/components/game/stadium/Props";
import { StaticBatch } from "./stadium/StaticBatch";
import { Ball } from "./stadium/StadiumBall";
import {
  framingFor,
  MANUAL_SHOT,
  SHOT_MIN_TIME,
  type ShotContext,
  type ShotId,
} from "./stadium/StadiumCameraFraming";
import { Stands } from "./stadium/StadiumStructure";
import { Pitch } from "./stadium/StadiumTurf";
import { Weather as WeatherParticles } from "./stadium/StadiumWeather";
import { presentationBall } from "./stadium/stadium-ball";

import { AdBoards } from "./stadium/StadiumAds";
import { Floodlights } from "./stadium/StadiumFloodlights";
import { Scoreboard } from "./stadium/StadiumScoreboard";

import { cameraOption, type CameraMode } from "@/game/camera-modes";
import { dprFor, isCoarsePointer } from "@/game/device";

import { AmbientLife } from "@/components/game/stadium/AmbientLife";
import { Atmosphere } from "@/components/game/stadium/Atmosphere";
import { BenchLife } from "@/components/game/stadium/BenchLife";
import { CrowdReaction } from "@/components/game/stadium/CrowdReaction";
import { PitchResponse } from "@/components/game/stadium/PitchResponse";
import { SidelineLife } from "@/components/game/stadium/SidelineLife";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";

import { captureGoalFocus, type GoalFocus, type GoalFocusRef } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type TimeOfDay, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { useResolvedVisual, useVisual } from "@/game/visual-settings";

import { Rig } from "./stadium/StadiumCameraRig";
import { SkyDome } from "./stadium/StadiumSky";
import { GoalFx } from "./stadium/StadiumGoalFx";
import { Officials } from "./stadium/StadiumOfficials";
import { FpsMeter, type FpsSample } from "./stadium/StadiumFpsMeter";

export type { CameraMode } from "@/game/camera-modes";
import type { Quality } from "./stadium/quality";
export type { Quality };
const SHADOW_SETTINGS = { type: THREE.PCFShadowMap };

/**
 * A física visual pode enriquecer o voo, o quique e o contato da bola sem
 * participar da simulação canônica. Replays antigos e o caminho sem Rapier
 * continuam apresentando a própria bola da partida.
 */
/* ---------------------------------------------------------------- gramado */

/** Tufos de grama instanciados perto das linhas laterais (só na qualidade alta). */
/**
 * Fibras de grama instanciadas com vento no vertex shader: nada é atualizado
 * na CPU por quadro, então dá para colocar dezenas de milhares de folhas.
 * A bola amassa a grama num raio curto ao passar.
 */
/* -------------------------------------------------------------- estrutura */

/**
 * Placas de LED: uma faixa contínua por linha lateral, com a textura
 * rolando na horizontal (como um painel de LED de transmissão real).
 */
/** Telão atualizado no máximo cinco vezes por segundo, sem worker de fontes. */
/** Concreto compartilhado por toda a estrutura (um material só, muitas peças). */
/* --------------------------------------------------------------- jogadores */

/* --------------------------------------------------------- pós-processamento */

/** Céu com degradê, nuvens volumosas, estrelas e sol/lua; gira bem devagar. */

/* ------------------------------------------------------------------- cena */

/* ------------------------------------------------------- arbitragem */

function Scene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
  adaptive,
}: {
  sim: SimView;
  mode: CameraMode;
  quality: Quality;
  look: ReturnType<typeof matchLook>;
  shadows: boolean;
  backend: GpuBackend;
  postIntensity: number;
  supporters?: SupporterMatchday | undefined;
  adaptive: boolean;
}) {
  useFrame(() => {
    const interpolated = sim as SimView & { renderTick?: (now?: number) => void };
    interpolated.renderTick?.();
  });
  const time = look.time;
  const pressure = useQualityPressure();
  const budget = useRuntimeSceneBudget();
  // O pós-processamento atual roda em WebGL2; no caminho WebGPU a imagem sai
  // direto do renderizador (tone mapping e exposição continuam ativos).
  const postOn = useVisual().postFx && backend === "webgl2";

  const goalPulse = useRef(0);
  const lastGoals = useRef(sim.stats.home.goals + sim.stats.away.goals);
  const goalFocus = useRef<GoalFocus | null>(null);
  const [replay, setReplay] = useState(false);
  const [moment, setMoment] = useState<"match" | "replay" | "drama">("match");
  const momentRef = useRef<"match" | "replay" | "drama">("match");

  useFrame((_, dt) => {
    const total = sim.stats.home.goals + sim.stats.away.goals;
    if (total !== lastGoals.current) {
      lastGoals.current = total;
      goalPulse.current = 1;
      goalFocus.current = captureGoalFocus(sim, total);
    }
    if (goalPulse.current > 0) {
      goalPulse.current = Math.max(0, goalPulse.current - dt * 0.22);
      if (goalPulse.current <= 0.01) goalFocus.current = null;
    }
    const r = goalPulse.current > 0.55;

    const m = goalPulse.current > 0.82 ? "drama" : r ? "replay" : "match";
    if (momentRef.current !== m) {
      momentRef.current = m;
      setMoment(m);
      setReplay(r);
    }
  });

  const awayClash = colorClash(sim.home.primary, sim.away.primary);
  const homeKit = useMemo(
    () => kitFor(sim.home.clubId, sim.home.primary, sim.home.secondary),
    [sim.home.clubId, sim.home.primary, sim.home.secondary],
  );
  const awayKit = useMemo(
    () => kitFor(sim.away.clubId, sim.away.primary, sim.away.secondary, awayClash),
    [sim.away.clubId, sim.away.primary, sim.away.secondary, awayClash],
  );

  const lighting = matchLighting(time, look.weather, quality === "baixa");
  const sunColor = lighting.keyColor;
  const visualBall = presentationBall(sim);

  return (
    <>
      <color attach="background" args={[lighting.sky]} />
      {/* Profundidade por horário: de noite a névoa fecha antes e dá volume às luzes */}
      <fog attach="fog" args={[lighting.sky, lighting.fogNear, lighting.fogFar]} />
      <AdaptiveEvents />
      <FrameProbe quality={quality} adaptive={adaptive} />

      {/* IBL local (sem HDR remoto): reflexos coerentes em traves, bola e kits */}
      {quality !== "baixa" ? (
        <Environment
          resolution={Math.round((quality === "alta" ? 384 : 192) * budget.textureScale)}
          frames={1}
        >
          <color attach="background" args={[lighting.sky]} />
          <Lightformer
            intensity={
              quality === "media" &&
              time === "dia" &&
              (look.weather === "seco" || look.weather === "molhado")
                ? 1.75
                : lighting.environmentKey
            }
            color={sunColor}
            position={[0, 24, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[60, 60, 1]}
          />
          <Lightformer
            intensity={time === "noite" ? 2.4 : 1.2}
            color="#dceaff"
            position={[-30, 14, 0]}
            rotation-y={Math.PI / 2}
            scale={[60, 8, 1]}
          />
          <Lightformer
            intensity={time === "noite" ? 2.4 : 1.2}
            color="#dceaff"
            position={[30, 14, 0]}
            rotation-y={-Math.PI / 2}
            scale={[60, 8, 1]}
          />
          <Lightformer
            intensity={0.8}
            color={
              time === "entardecer" && look.weather !== "chuva" && look.weather !== "neve"
                ? "#ff9b5c"
                : "#d5e3ef"
            }
            position={[0, 6, -40]}
            scale={[60, 8, 1]}
          />
        </Environment>
      ) : null}

      {/* The low profile has no IBL cube. Compensate with existing lights,
          keeping kit/grass readable without allocating environment targets. */}
      <ambientLight
        intensity={
          quality === "baixa" ? (time === "dia" ? 0.32 : 0.22) : time === "dia" ? 0.1 : 0.075
        }
      />
      <hemisphereLight
        intensity={lighting.hemiIntensity}
        groundColor={lighting.groundColor}
        color={lighting.hemiColor}
      />
      <directionalLight
        position={lighting.keyPosition}
        intensity={lighting.keyIntensity}
        color={sunColor}
        castShadow={shadows && budget.shadows}
        shadow-mapSize={
          quality === "alta" && pressure < 5
            ? [2048, 2048]
            : quality === "media"
              ? [1024, 1024]
              : [512, 512]
        }
        shadow-bias={-0.00014}
        shadow-normalBias={quality === "alta" ? 0.014 : 0.03}
        shadow-radius={quality === "alta" ? 2.4 : 1.2}
        shadow-camera-near={12}
        shadow-camera-far={165}
        shadow-camera-left={-52}
        shadow-camera-right={52}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
      />
      <directionalLight
        position={[-55, 48, -35]}
        intensity={lighting.fillIntensity}
        color={time === "entardecer" ? "#c9d2ee" : "#e5ecf2"}
      />
      {/* Contraluz de transmissão: recorta a silhueta dos atletas contra o gramado. */}
      <directionalLight
        position={[0, 18, -55]}
        intensity={
          (time === "entardecer" ? 0.58 : time === "noite" ? 0.34 : 0.3) *
          (quality === "alta" ? 1 : 0.82)
        }
        color={
          time === "entardecer" && look.weather !== "chuva" && look.weather !== "neve"
            ? "#ff9b62"
            : "#d5e3ef"
        }
      />
      <directionalLight
        position={[0, 14, 52]}
        intensity={time === "noite" ? 0.24 : 0.2}
        color={time === "entardecer" ? "#ffd2a8" : "#cfe6ff"}
      />

      <SkyDome time={time} weather={look.weather} />
      <Pitch
        quality={quality}
        sim={sim}
        wet={look.wet}
        mow={look.mow}
        webgl2={backend === "webgl2"}
      />
      {/* Arranhões de chute, escorregões e rastro da bola: 1 desenho no total */}
      <PitchResponse sim={sim} quality={quality} />
      {quality !== "baixa" ? (
        <WeatherParticles
          weather={look.weather}
          wind={look.wind}
          quality={quality}
          density={budget.weatherDensity}
        />
      ) : null}
      {quality !== "baixa" ? <Officials sim={sim} quality={quality} /> : null}
      <BenchLife sim={sim} quality={quality} goalPulse={goalPulse} />

      <AdBoards homeColor={sim.home.primary} awayColor={sim.away.primary} />
      {/* Feixes volumétricos, poeira e brilho das lâmpadas (custo fixo e baixo) */}
      <Atmosphere
        time={time}
        quality={quality}
        weather={look.weather}
        webgl2={backend === "webgl2"}
      />
      {/* Batch only fixed scenery. Players, ball, officials, weather and
          reactions retain their existing independent animation ownership. */}
      <StaticBatch
        enabled={quality !== "alta"}
        bucket="static"
        shadows={budget.shadows}
        signature={`fixed:${quality}:${time}:${budget.stage}:${sim.home.primary}:${sim.away.primary}:${supporters?.occupancy}`}
      >
        <Floodlights time={time} quality={quality} />
        <Stands
          sim={sim}
          homeColor={sim.home.primary}
          awayColor={sim.away.primary}
          quality={quality}
          goalPulse={goalPulse}
          night={time !== "dia"}
          supporters={supporters}
          webgl2={backend === "webgl2"}
        />
        {/* O que a arquibancada faz em cada lance: gol, chance, falta, protesto */}
        <StadiumProps
          rings={budget.propRings}
          quality={quality}
          homeColor={sim.home.primary}
          awayColor={sim.away.primary}
          sim={sim}
        />
        <Scoreboard sim={sim} replay={replay} goalPulse={goalPulse} />
        <SidelineLife goalPulse={goalPulse} />
      </StaticBatch>
      <CrowdReaction
        sim={sim}
        quality={quality}
        night={time === "noite"}
        color={sim.home.primary}
        supporters={supporters}
      />
      <AmbientLife time={time} />
      <Ball sim={sim} quality={quality} hiVis={look.hiVisBall} wet={look.wet} />
      <MatchSurfaceProvider
        sim={sim}
        weather={surfaceWeather(look.weather)}
        quality={quality}
        intensity={time === "noite" ? 1.1 : 1}
      >
        <MatchPlayers
          sim={sim}
          homeKit={homeKit}
          awayKit={awayKit}
          goalPulse={goalPulse}
          goalFocus={goalFocus}
          quality={quality}
          mode={mode}
          replay={replay}
          budget={budget}
        />
      </MatchSurfaceProvider>
      <GoalFx goalPulse={goalPulse} quality={quality} density={budget.goalFxDensity} />
      <Rig sim={sim} mode={mode} goalPulse={goalPulse} goalFocus={goalFocus} />
      <PostFX
        grading={
          postOn
            ? { time, weather: GRADE_WEATHER[surfaceWeather(look.weather)], moment }
            : undefined
        }
        quality={
          !postOn || budget.post === "off"
            ? "baixa"
            : budget.post === "cinema"
              ? "alta"
              : pressure >= 6
                ? "media"
                : quality
        }
        replay={replay}
        moment={moment}
        time={time}
        intensity={postIntensity}
        cinematic={cameraOption(mode).cinematicTreatment}
      />
    </>
  );
}

/**
 * Clima do jogo (`matchday.ts`: seco, molhado, chuva, neve) convertido para o
 * vocabulário da correção de cor e da superfície dos atletas.
 */
type SurfaceWeatherName = "limpo" | "nublado" | "chuva" | "neve";

const WEATHER_ALIAS: Record<Weather, SurfaceWeatherName> = {
  seco: "limpo",
  molhado: "nublado",
  chuva: "chuva",
  neve: "neve",
};

const GRADE_WEATHER: Record<SurfaceWeatherName, GradeWeather> = {
  limpo: "limpo",
  nublado: "nublado",
  chuva: "chuva",
  neve: "neve",
};

function surfaceWeather(weather: Weather): SurfaceWeatherName {
  return WEATHER_ALIAS[weather] ?? "limpo";
}

function CompressedTextures({ enabled }: { enabled: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => onTurfDetailReady(() => invalidate()), [invalidate]);
  return <Ktx2CanvasAssets enabled={enabled} />;
}

/** Finish a camera transition in demand mode, then release the GPU while paused. */
function PausedCameraFrames({
  paused,
  visible,
  mode,
}: {
  paused: boolean;
  visible: boolean;
  mode: CameraMode;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const remaining = useRef(0);
  useEffect(() => {
    remaining.current = paused && visible ? 1.2 : 0;
    if (remaining.current > 0) invalidate();
  }, [paused, visible, mode, invalidate]);
  useFrame((_, dt) => {
    if (remaining.current <= 0) return;
    remaining.current -= Math.min(dt, 0.1);
    if (remaining.current > 0) invalidate();
  });
  return null;
}

function Stadium3DImpl({
  sim,
  mode,
  quality: deviceQuality,
  pixelRatio,
  supporters,
  paused = false,
  onFirstFrame,
}: {
  sim: SimView;
  mode: CameraMode;
  quality: Quality;
  pixelRatio?: number;
  paused?: boolean;
  supporters?: SupporterMatchday | undefined;
  onFirstFrame?: (() => void) | undefined;
}) {
  const vis = useResolvedVisual(sim.home.clubId);
  const startedAt = useRef(performance.now());
  // Escolha do jogador em /visual manda; "auto" segue a detecção do aparelho.
  // Cinema usa a geometria alta e amplia seletivamente resolução/efeitos sem
  // duplicar toda a árvore 3D nem quebrar configurações antigas.
  const quality: Quality =
    vis.quality === "auto" ? deviceQuality : vis.quality === "cinema" ? "alta" : vis.quality;
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
    () => resolveRuntimeSceneBudget(sceneTier, pressure, isCoarsePointer()),
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

  const requestedDpr =
    pixelRatio === undefined
      ? dpr
      : Math.min(GRAPHICS_PROFILES[quality].maxPixelRatio, Math.max(0.6, pixelRatio));

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
    >
      <GraphicsBoundary>
        <Canvas
          key={backend}
          shadows={shadowsOn ? SHADOW_SETTINGS : false}
          frameloop={visible && !paused ? "always" : "demand"}
          dpr={requestedDpr}
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
          <MobileFramebufferBudget tier={sceneTier} requested={requestedDpr} />
          <FirstMatchFrame
            startedAt={startedAt.current}
            quality={quality}
            backend={backend}
            onFirstFrame={onFirstFrame}
          />
          <PausedCameraFrames paused={paused} visible={visible} mode={mode} />
          <CompressedTextures enabled={quality === "alta"} />
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
                mode={mode}
                quality={eff}
                look={look}
                shadows={shadowsOn}
                backend={backend}
                postIntensity={vis.postIntensity * (vis.quality === "cinema" ? 1.12 : 1)}
                supporters={supporters}
                adaptive={vis.adaptive}
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
