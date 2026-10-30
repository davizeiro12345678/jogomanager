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
import { stadiumEnvironmentResolution } from "@/game/graphics/pmrem-budget";
import { CanvasLifecycle } from "./CanvasLifecycle";
import { Ktx2CanvasAssets } from "./Ktx2CanvasAssets";
import { subscribeRenderedFrames } from "./graphics-probe";
import { onTurfDetailReady } from "./stadium/textures/turf-detail";

import { PostFX } from "@/components/game/post/LazyPostFX";
import { createWebGPURenderer, detectWebGPU, type GpuBackend } from "@/components/game/renderer";
import { WebGpuClusteredLighting, WebGpuPipelinePrewarm } from "./webgpu-advanced-pipeline";
import { useWebGpuCsmShadow } from "@/components/game/webgpu-csm-shadow";
import { WebGpuTemporalAA } from "@/components/game/WebGpuTemporalAA";
import { temporalAAOptedIn, temporalUpscaleOptedIn } from "@/game/graphics/temporal-settings";

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

export type { CameraMode } from "@/game/camera-modes";
export type Quality = "alta" | "media" | "baixa";
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

function Rig({
  sim,
  mode,
  goalPulse,
  goalFocus,
}: {
  sim: SimView;
  mode: CameraMode;
  goalPulse: React.MutableRefObject<number>;
  goalFocus: GoalFocusRef;
}) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  const anchor = useMemo(() => new THREE.Vector2(), []); // bola com zona morta
  const hold = useRef(new ShotHold<ShotId>("wide"));
  const state = useRef({ shot: "wide" as ShotId, since: 0, prev: "wide" as ShotId, cut: 0 });

  useFrame(({ camera, clock }, dtRaw) => {
    const dt = Math.min(0.05, dtRaw); // trava picos de frame para não dar solavanco
    const s = state.current;
    s.since += dt;
    s.cut = Math.max(0, s.cut - dt);

    const visualBall = presentationBall(sim);
    const pulse = goalPulse.current;
    const focus = pulse > 0.05 ? goalFocus.current : null;
    const goalHero = focus
      ? (sim.players.find((player) => player.id === focus.scorerId) ?? null)
      : null;
    const speed = Math.hypot(visualBall.vx, visualBall.vz);
    const interest = broadcastInterest(sim);
    const lead = interest.lead / 0.18;
    const rawX = focus?.x ?? visualBall.x + visualBall.vx * 0.18 * lead;
    const rawZ = focus?.z ?? visualBall.z + visualBall.vz * 0.18 * lead;
    // zona morta: só move o alvo quando a bola sai de um raio pequeno
    const dead = 0.9;
    const dx = rawX - anchor.x;
    const dz = rawZ - anchor.y;
    const dist = Math.hypot(dx, dz);
    if (dist > dead) {
      const k = (dist - dead) / dist;
      anchor.x += dx * k;
      anchor.y += dz * k;
    }

    const attackDir = focus ? (focus.side === "home" ? 1 : -1) : sim.possession === "home" ? 1 : -1;
    const nearGoal = Math.min(
      1,
      Math.max(0, (Math.abs(anchor.x) - FIELD_X * 0.45) / (FIELD_X * 0.55)),
    );
    const holder = goalHero ?? sim.players.find((player) => player.id === sim.ball.holder) ?? null;
    const holderSpeed = holder ? Math.hypot(holder.vx, holder.vz) : 0;
    const heading =
      holder && holderSpeed > 0.3
        ? Math.atan2(holder.vx, holder.vz)
        : Math.atan2(visualBall.vx || attackDir, visualBall.vz || 0);
    const ctx: ShotContext = {
      bx: anchor.x,
      bz: anchor.y,
      speed,
      height: visualBall.height,
      attackDir,
      pulse,
      nearGoal,
      holder,
      heading,
      focusX: focus?.x ?? null,
      focusZ: focus?.z ?? null,
    };

    const manual = mode !== "broadcast" ? MANUAL_SHOT[mode] : undefined;
    // O modo broadcast escolhe planos com intenção editorial. Cada condição
    // tem uma composição própria; o ShotHold impede cortes frenéticos quando a
    // bola cruza o meio-campo ou o simulador oscila entre dois limiares.
    let want: ShotId;
    if (manual) {
      want = manual;
    } else if (mode === "director") {
      // Diretor cinematográfico: alterna planos com uma lógica editorial
      // determinística. A ordem evita câmera de jogador em bola aérea e mantém
      // os cortes interessantes sem perder a leitura tática da jogada.
      if (pulse > 0.88) {
        want = "celebration";
      } else if (pulse > 0.5) {
        want = s.prev === "netcam" ? "orbit" : "netcam";
      } else if (interest.danger > 0.78 && speed > 11) {
        want = "netcam";
      } else if (ctx.height > 4.2 || interest.counter || speed > 17) {
        want = "skycam";
      } else if (interest.nearby >= 3 && speed < 6.2) {
        want = "playercam";
      } else if (ctx.nearGoal > 0.46) {
        want = "sideline";
      } else if (s.since > 10) {
        want = s.shot === "crane" ? "orbit" : s.shot === "orbit" ? "sideline" : "crane";
      } else {
        want = "crane";
      }
    } else if (pulse > 0.88) {
      want = "celebration";
    } else if (pulse > 0.5) {
      want = s.prev === "netcam" ? "orbit" : "netcam";
    } else if (interest.counter) {
      want = s.shot === "drone" ? "lowline" : "drone";
    } else if (ctx.height > 4.2) {
      want = "drone";
    } else if (interest.danger > 0.78 && speed > 12) {
      want = "netcam";
    } else if (interest.nearby >= 3 && interest.danger > 0.35 && speed < 5.5) {
      want = "duel";
    } else if (speed > 17) {
      want = s.shot === "drone" ? "lowline" : "drone";
    } else if (ctx.nearGoal > 0.48) {
      want = "lowline";
    } else if (interest.nearby >= 2 && ctx.nearGoal > 0.32 && speed < 2.5) {
      want = "duel";
    } else if (s.since > 12 && s.shot === "wide") {
      want = "tower";
    } else {
      want = "wide";
    }
    const goalCut = !manual && pulse > 0.88;
    const selected = hold.current.update(
      want,
      dt,
      SHOT_MIN_TIME[s.shot],
      Boolean(manual) || goalCut,
    );
    if (selected !== s.shot) {
      s.prev = s.shot;
      s.shot = selected;
      s.since = 0;
      s.cut = 0.45;
    }
    const f = framingFor(s.shot, ctx, clock.elapsedTime);
    pos.set(f.px, f.py, f.pz);
    // Nenhum modo manual coloca a lente abaixo do gramado, mesmo após o shake.
    pos.y = Math.max(2.1, pos.y);
    look.set(f.lx, f.ly, f.lz);

    // tremor discreto só em comemoração/perigo, com amplitude limitada
    if (pulse > 0.05) {
      const amp = Math.min(0.45, pulse * 0.5);
      pos.x += Math.sin(clock.elapsedTime * 19) * amp;
      pos.y += Math.cos(clock.elapsedTime * 15) * amp * 0.5;
    }

    // amortecimento por tempo real + limite de velocidade linear
    const closeShot = s.shot === "duel" || s.shot === "playercam" || s.shot === "celebration";
    const base = s.cut > 0 ? 0.18 : closeShot ? 0.3 : s.shot === "skycam" ? 0.7 : 0.55;
    easing.damp3(camera.position, pos, base, dt);
    easing.damp3(smoothLook, look, s.cut > 0 ? 0.16 : 0.3, dt);
    camera.lookAt(smoothLook);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const horizontalFov = f.fov - pulse * 2;
      const wantFov =
        cam.aspect < 1.4
          ? THREE.MathUtils.radToDeg(
              2 *
                Math.atan(
                  (Math.tan(THREE.MathUtils.degToRad(horizontalFov / 2)) * 1.4) /
                    Math.max(0.6, cam.aspect),
                ),
            )
          : horizontalFov;
      if (Math.abs(cam.fov - wantFov) > 0.01) {
        cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-dt * 3.2));
        cam.updateProjectionMatrix();
      }
    }
  });
  return null;
}

/* --------------------------------------------------------- pós-processamento */

/** Céu com degradê, nuvens volumosas, estrelas e sol/lua; gira bem devagar. */
function SkyDome({ time, weather }: { time: TimeOfDay; weather: Weather }) {
  const tex = useMemo(() => skyTexture(time), [time]);
  const material = useMemo(() => {
    const surface = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    if (weather === "chuva" || weather === "neve") {
      // Keep the cached cloud detail but close the blue sky and the solar halo
      // under active precipitation. One existing sky draw, no extra overlay.
      const overcast = new THREE.Color(matchLighting(time, weather, false).sky);
      surface.customProgramCacheKey = () => "stadium-overcast-sky-v1";
      surface.onBeforeCompile = (shader) => {
        shader.uniforms["skyOvercastColor"] = { value: overcast };
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 skyOvercastColor;")
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            float skyLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(skyLuminance), skyOvercastColor, 0.58), 0.88);`,
          );
      };
    }
    return surface;
  }, [tex, time, weather]);
  useEffect(() => () => material.dispose(), [material]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.0035;
  });
  if (!tex) return null;
  return (
    <mesh ref={ref} scale={[-1, 1, 1]} userData={{ census: "sky" }}>
      <sphereGeometry args={[420, 48, 28]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* ------------------------------------------------------------------- cena */

/**
 * Festa do gol: papel picado colorido caindo sobre o gramado e fumaça de
 * sinalizador subindo atrás do gol, tudo instanciado e disparado pelo pulso.
 */
function GoalFx({
  goalPulse,
  quality,
  density = 1,
}: {
  goalPulse: React.MutableRefObject<number>;
  quality: Quality;
  density?: number;
}) {
  const COUNT = Math.max(
    0,
    Math.round((quality === "alta" ? 320 : 140) * useVisual().particles * density),
  );
  const ref = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: 0,
        y: -5,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        r: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 6,
      })),
    [COUNT],
  );
  const armed = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < COUNT; i++) {
      col.setHSL(Math.random(), 0.85, 0.6);
      mesh.setColorAt(i, col);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [COUNT, col]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const mesh = ref.current;
    if (!mesh) return;
    if (goalPulse.current <= 0.01 && !armed.current) return;

    if (goalPulse.current > 0.9 && !armed.current) {
      armed.current = true;
      for (const p of parts) {
        p.x = (Math.random() * 2 - 1) * (FIELD_X * 0.8);
        p.y = 16 + Math.random() * 10;
        p.z = (Math.random() * 2 - 1) * (FIELD_Z * 0.8);
        p.vx = (Math.random() - 0.5) * 1.2;
        p.vy = -1 - Math.random() * 1.5;
        p.vz = (Math.random() - 0.5) * 1.2;
      }
    }
    if (goalPulse.current < 0.2) armed.current = false;

    for (let i = 0; i < COUNT; i++) {
      const p = parts[i]!;
      if (p.y > 0.05) {
        p.vy -= dt * 2.2;
        p.x += (p.vx + Math.sin(clock.elapsedTime * 2 + i) * 0.4) * dt;
        p.z += (p.vz + Math.cos(clock.elapsedTime * 1.7 + i) * 0.4) * dt;
        p.y = Math.max(0.03, p.y + p.vy * dt);
        p.r += p.spin * dt;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.r, p.r * 0.7, p.r * 0.4);
      dummy.scale.setScalar(p.y > 0.05 ? 1 : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const sm = smoke.current;
    if (sm) {
      const glow = goalPulse.current;
      for (let i = 0; i < 12; i++) {
        const side = i < 6 ? -1 : 1;
        const t = (clock.elapsedTime * 0.35 + i * 0.17) % 1;
        dummy.position.set(side * (FIELD_X + 6), 1 + t * 12, (i % 6) * 6 - 15);
        dummy.rotation.set(0, 0, t * 1.5);
        dummy.scale.setScalar(glow > 0.05 ? (2 + t * 9) * glow : 0.0001);
        dummy.updateMatrix();
        sm.setMatrixAt(i, dummy.matrix);
      }
      sm.instanceMatrix.needsUpdate = true;
      (sm.material as THREE.MeshBasicMaterial).opacity = 0.16 * glow;
    }
  });

  return (
    <group>
      <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, COUNT]}>
        <planeGeometry args={[0.28, 0.16]} />
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smoke} frustumCulled={false} args={[undefined, undefined, 12]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#ff6a3d"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------- arbitragem */

/**
 * Árbitro e assistentes com corpo articulado: tronco com gola, calção, meiões,
 * braços que balançam na corrida, apito no pescoço e cartões no bolso. O
 * árbitro corre na diagonal clássica e levanta o cartão quando há falta; os
 * assistentes acompanham a linha e levantam a bandeira quando o lance para.
 */
function Officials({ sim, quality }: { sim: SimView; quality: Quality }) {
  return (
    <group>
      <OfficialRig sim={sim} role="ref" quality={quality} />
      <OfficialRig sim={sim} role="ar1" quality={quality} />
      <OfficialRig sim={sim} role="ar2" quality={quality} />
    </group>
  );
}

/**
 * Medidor de quadros: amostra o tempo entre quadros e reporta uma vez por
 * segundo a taxa instantânea, a média e o pior caso (p95) da partida inteira.
 * Fica dentro do Canvas para não forçar re-render da árvore 3D.
 */
function FpsMeter({
  onSample,
  backend,
  quality,
}: {
  onSample: (s: FpsSample) => void;
  backend: GpuBackend;
  quality: Quality;
}) {
  const frameTimes = useMemo(() => new FrameMetrics(180 * 60), []);
  const gl = useThree((state) => state.gl);
  const sampleCallback = useRef(onSample);
  sampleCallback.current = onSample;
  useEffect(() => {
    frameTimes.reset();
    let last = 0,
      reportAt = 0,
      started = 0,
      frames = 0;
    return subscribeRenderedFrames(gl, (frame) => {
      if (document.hidden) {
        last = started = reportAt = frames = 0;
        return;
      }
      if (!last) {
        last = started = reportAt = frame.now;
        return;
      }
      const deltaMs = frame.now - last;
      last = frame.now;
      if (frame.now - started < 2000) {
        reportAt = frame.now;
        return;
      }
      frameTimes.add(deltaMs);
      frames += 1;
      if (frame.now - reportAt < 1000) return;
      const fps = (frames * 1000) / (frame.now - reportAt);
      reportAt = frame.now;
      frames = 0;
      const metrics = frameTimes.summary();
      const meanMs = metrics.meanMs;
      const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
      const sample = {
        fps,
        avg: 1000 / Math.max(1, meanMs),
        p95FrameMs: metrics.p95,
        p99FrameMs: metrics.p99,
        onePercentLow: metrics.onePercentLow,
        frameMs: meanMs,
        backend,
        rendererBackend: rendererMetadata(gl).kind,
        quality,
        width: frame.width,
        height: frame.height,
        pixelRatio: frame.dpr,
        triangles: frame.triangles,
        drawCalls: frame.draws,
        geometries: frame.geometries,
        textures: frame.textures,
        programs: frame.programs,
        memoryMb: memory.memory ? Math.round(memory.memory.usedJSHeapSize / 1_048_576) : null,
        measuredAt: new Date().toISOString(),
      };
      sampleCallback.current(sample);
      try {
        localStorage.setItem("manager3d.performance.latest", JSON.stringify(sample));
      } catch {
        // Medição continua visível quando o armazenamento está indisponível.
      }
    });
  }, [gl, quality, backend, frameTimes]);

  return null;
}

type FpsSample = {
  fps: number;
  avg: number;
  p95FrameMs: number;
  p99FrameMs: number;
  onePercentLow: number;
  frameMs: number;
  backend: GpuBackend;
  quality: Quality;
  width: number;
  height: number;
  triangles: number;
  drawCalls: number;
  memoryMb: number | null;
  measuredAt: string;
};

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

  const sunShadowRef = useRef<THREE.DirectionalLight>(null);
  useWebGpuCsmShadow(sunShadowRef, backend === "webgpu" && quality === "alta" && shadows);

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
          resolution={stadiumEnvironmentResolution(quality, budget.textureScale)}
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
        ref={sunShadowRef}
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
      antialias: eff === "media" && !(backend === "webgpu" && temporalAAOptedIn()),
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
          {backend === "webgpu" && (temporalAAOptedIn() || temporalUpscaleOptedIn()) ? (
            <WebGpuTemporalAA />
          ) : null}
          <WebGpuClusteredLighting enabled={backend === "webgpu"} quality={eff} />
          <WebGpuPipelinePrewarm enabled={backend === "webgpu" && quality === "alta"} />
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
