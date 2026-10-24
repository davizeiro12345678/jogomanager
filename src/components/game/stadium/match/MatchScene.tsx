import {
  useQualityPressure,
  useRuntimeSceneBudget,
} from "@/components/game/runtime-budget-context";

import { useFrame } from "@react-three/fiber";

import { Environment, Lightformer, AdaptiveEvents } from "@react-three/drei";

import { useMemo, useRef, useState } from "react";

import { MatchFrameProbe as FrameProbe } from "@/components/game/LazyFrameProbe";

import { MatchPlayers } from "@/components/game/players/MatchPlayers";

import { PostFX } from "@/components/game/post/LazyPostFX";
import { type GpuBackend } from "@/components/game/renderer";

import { cameraOption, type CameraMode } from "@/game/camera-modes";

import { kitFor, colorClash } from "@/game/kits";
import type { SupporterMatchday } from "@/game/career-world-types";
import { PitchResponse } from "@/components/game/stadium/PitchResponse";
import { StadiumShell } from "@/components/game/stadium/StadiumShell";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";

import type { GradeWeather } from "@/game/graphics/grade";
import { type SimView } from "@/game/sim-types";
import type { PlayerLook } from "@/game/player-model";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import { matchLook, type Weather } from "@/game/matchday";
import { matchLighting } from "@/game/match-lighting";
import { useVisual } from "@/game/visual-settings";

import { presentationBall, type Quality } from "./shared";
import { Suspense, lazy } from "react";
import { Pitch } from "./MatchPitch";
import { Ball } from "./MatchBall";
import { Rig } from "./MatchCamera";
import { Officials } from "./MatchOfficials";
import { AdBoards, Scoreboard, Floodlights } from "./MatchFurniture";
const Stands = lazy(() => import("./MatchStands").then((m) => ({ default: m.Stands })));
const Weather = lazy(() => import("./MatchWeather").then((m) => ({ default: m.Weather })));
const SkyDome = lazy(() => import("./MatchEffects").then((m) => ({ default: m.SkyDome })));
const GoalFx = lazy(() => import("./MatchEffects").then((m) => ({ default: m.GoalFx })));
const StadiumProps = lazy(() => import("../Props").then((m) => ({ default: m.StadiumProps })));
const Atmosphere = lazy(() => import("../Atmosphere").then((m) => ({ default: m.Atmosphere })));
const AmbientLife = lazy(() => import("../AmbientLife").then((m) => ({ default: m.AmbientLife })));
const CrowdReaction = lazy(() =>
  import("../CrowdReaction").then((m) => ({ default: m.CrowdReaction })),
);
const BenchLife = lazy(() => import("../BenchLife").then((m) => ({ default: m.BenchLife })));
const SidelineLife = lazy(() =>
  import("../SidelineLife").then((m) => ({ default: m.SidelineLife })),
);
export function Scene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
  adaptive,
  lookOverrides,
  reducedMotion = false,
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
  lookOverrides?: ReadonlyMap<string, PlayerLook> | undefined;
  reducedMotion?: boolean;
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
          resolution={Math.round((quality === "alta" ? 128 : 64) * budget.textureScale)}
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
            intensity={time === "noite" ? 2.4 : time === "dia" ? 0.78 : 1.2}
            color="#dceaff"
            position={[-30, 14, 0]}
            rotation-y={Math.PI / 2}
            scale={[60, 8, 1]}
          />
          <Lightformer
            intensity={time === "noite" ? 2.4 : time === "dia" ? 0.78 : 1.2}
            color="#dceaff"
            position={[30, 14, 0]}
            rotation-y={-Math.PI / 2}
            scale={[60, 8, 1]}
          />
          <Lightformer
            intensity={time === "dia" ? 0.55 : 0.8}
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

      <Suspense fallback={null}>
        <SkyDome time={time} weather={look.weather} />
      </Suspense>
      <Pitch
        quality={quality}
        sim={sim}
        wet={look.wet}
        mow={look.mow}
        webgl2={backend === "webgl2"}
      />
      {/* Arranhões de chute, escorregões e rastro da bola: 1 desenho no total */}
      <PitchResponse sim={sim} quality={quality} />
      {quality !== "baixa" && (look.weather === "chuva" || look.weather === "neve") ? (
        <Suspense fallback={null}>
          <Weather
            weather={look.weather}
            wind={look.wind}
            quality={quality}
            density={budget.weatherDensity}
            webgl2={backend === "webgl2"}
          />
        </Suspense>
      ) : null}
      {quality !== "baixa" ? <Officials sim={sim} quality={quality} /> : null}
      {quality !== "baixa" && pressure < 6 ? (
        <Suspense fallback={null}>
          <BenchLife sim={sim} quality={quality} goalPulse={goalPulse} />
        </Suspense>
      ) : null}

      <AdBoards homeColor={sim.home.primary} awayColor={sim.away.primary} />
      <Floodlights time={time} quality={quality} />
      {/* Feixes volumétricos, poeira e brilho das lâmpadas (custo fixo e baixo) */}
      {quality !== "baixa" && pressure < 6 ? (
        <Suspense fallback={null}>
          <Atmosphere
            time={time}
            quality={quality}
            weather={look.weather}
            webgl2={backend === "webgl2"}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={<StadiumShell rings={budget.propRings} />}>
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
      </Suspense>
      {/* O que a arquibancada faz em cada lance: gol, chance, falta, protesto */}
      {quality !== "baixa" && pressure < 6 ? (
        <Suspense fallback={null}>
          <CrowdReaction
            sim={sim}
            quality={quality}
            night={time === "noite"}
            color={sim.home.primary}
            supporters={supporters}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <StadiumProps
          rings={budget.propRings}
          quality={quality}
          homeColor={sim.home.primary}
          awayColor={sim.away.primary}
          sim={sim}
        />
      </Suspense>
      <Scoreboard sim={sim} replay={replay} goalPulse={goalPulse} />
      {quality !== "baixa" && pressure < 5 ? (
        <Suspense fallback={null}>
          <SidelineLife goalPulse={goalPulse} />
          <AmbientLife time={time} />
        </Suspense>
      ) : null}
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
          lookOverrides={lookOverrides}
        />
      </MatchSurfaceProvider>
      {goalPulse.current > 0 && !reducedMotion && (
        <Suspense fallback={null}>
          <GoalFx goalPulse={goalPulse} quality={quality} density={budget.goalFxDensity} />
        </Suspense>
      )}
      <Rig
        sim={sim}
        mode={mode}
        goalPulse={goalPulse}
        goalFocus={goalFocus}
        reducedMotion={reducedMotion}
      />
      <PostFX
        // Native canvas MSAA does not smooth the offscreen scene buffer used
        // by a zero-sample composer. Its FXAA/SMAA must still smooth that image.
        antialias={true}
        legacyMatchEffects={
          typeof location !== "undefined" &&
          location.pathname.endsWith("/graphics-benchmark.html") &&
          new URLSearchParams(location.search).get("effectsPath") === "legacy"
        }
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
