import { AdaptiveEvents } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../LazyFrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { StadiumEnvironment } from "./StadiumEnvironment";
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
  adaptive,
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
  adaptive,
  measurementKey,
  suspended,
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
  adaptive,
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
  sim,
  mode,
  quality,
  look,
  shadows,
  backend,
  postIntensity,
  supporters,
  adaptive,
  measurementKey,
  suspended,
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
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
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
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
  measurementKey?: string;
  suspended?: boolean;
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
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
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
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
  measurementKey?: string;
  suspended?: boolean;
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
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
  const fixtureKey = stadiumFixtureKey(sim.home.clubId, sim.away.clubId);
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
import { AdaptiveEvents, Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { FrameProbe } from "../FrameProbe";
import { useQualityPressure, useRuntimeSceneBudget } from "../runtime-budget-context";
import { MatchPlayers } from "../players/MatchPlayers";
import { PostFX } from "../post/LazyPostFX";
import type { GpuBackend } from "../renderer";
import { StadiumProps } from "./Props";
import { StaticBatch } from "./StaticBatch";
import { Ball } from "./StadiumBall";
import { Stands } from "./StadiumStructure";
import { Pitch } from "./StadiumTurf";
import { Weather as WeatherParticles } from "./StadiumWeather";
import { presentationBall } from "./stadium-ball";
import { AdBoards } from "./StadiumAds";
import { Floodlights } from "./StadiumFloodlights";
import { Scoreboard } from "./StadiumScoreboard";
import { AmbientLife } from "./AmbientLife";
import { Atmosphere } from "./Atmosphere";
import { BenchLife } from "./BenchLife";
import { CrowdReaction } from "./CrowdReaction";
import { PitchResponse } from "./PitchResponse";
import { SidelineLife } from "./SidelineLife";
import { Rig } from "./StadiumCameraRig";
import { SkyDome } from "./StadiumSky";
import { GoalFx } from "./StadiumGoalFx";
import { Officials } from "./StadiumOfficials";
import type { Quality } from "./quality";
import { stadiumFixtureKey } from "./stadium-cosmetics";
import { cameraOption, type CameraMode } from "@/game/camera-modes";
import type { SupporterMatchday } from "@/game/career-world-types";
import { MatchSurfaceProvider } from "@/game/graphics/surface-context";
import { colorClash, kitFor } from "@/game/kits";
import { captureGoalFocus, type GoalFocus } from "@/game/goal-choreography";
import type { GradeWeather } from "@/game/graphics/grade";
import { matchLighting } from "@/game/match-lighting";
import { matchLook, type Weather } from "@/game/matchday";
import type { SimView } from "@/game/sim-contracts";
import { useVisual } from "@/game/visual-settings";

export function StadiumScene({
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
  const fixtureKey = stadiumFixtureKey(sim.home.clubId, sim.away.clubId);
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
      <FrameProbe
        quality={quality}
        adaptive={adaptive}
        {...(measurementKey === undefined ? {} : { measurementKey })}
        {...(suspended === undefined ? {} : { suspended })}
      />

      {/* IBL local (sem HDR remoto): reflexos coerentes em traves, bola e kits */}

      {/* IBL local (sem HDR remoto): reflexos coerentes em traves, bola e kits */}
      <StadiumEnvironment
        time={time}
        weather={look.weather}
        quality={quality}
        textureScale={budget.textureScale}
      />

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
          fixtureKey={fixtureKey}
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
        fixtureKey={fixtureKey}
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
        <SidelineLife goalPulse={goalPulse} fixtureKey={fixtureKey} />
      </StaticBatch>
      <CrowdReaction
        sim={sim}
        quality={quality}
        night={time === "noite"}
        color={sim.home.primary}
        supporters={supporters}
        fixtureKey={fixtureKey}
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
      <GoalFx
        goalPulse={goalPulse}
        quality={quality}
        density={budget.goalFxDensity}
        fixtureKey={fixtureKey}
      />
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
