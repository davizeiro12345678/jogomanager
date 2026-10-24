import { framingFor, framingFov } from "../../../../game/graphics/match-framing";
import type { ShotId, ShotContext } from "../../../../game/graphics/match-framing";
import { broadcastInterest, ShotHold } from "@/game/broadcast-interest";

import { useFrame } from "@react-three/fiber";

import { easing } from "maath";
import type React from "react";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { type CameraMode } from "@/game/camera-modes";
import { keepPitchCameraInRunoff } from "@/game/stand-camera";

import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { type SimView } from "@/game/sim-types";

import { type GoalFocusRef } from "@/game/goal-choreography";

import { presentationBall } from "./shared";
import { accessibleMatchCamera } from "@/game/camera-motion-policy";

/** Planos manuais: o jogador escolheu um enquadramento fixo, o diretor obedece. */
const MANUAL_SHOT: Partial<Record<CameraMode, ShotId>> = {
  broadcast: "wide",
  tactical: "tower",
  goal: "netcam",
  fan: "stand",
  rail: "lowline",
  behind: "drone",
  cinematic: "crane",
  player: "playercam",
  sideline: "sideline",
  skycam: "skycam",
};

/** Tempo mínimo em cada plano (s) — impede corte nervoso. */
const SHOT_MIN_TIME: Record<ShotId, number> = {
  wide: 4.5,
  drone: 3.5,
  skycam: 4,
  lowline: 3,
  sideline: 3.2,
  duel: 2.2,
  playercam: 2.6,
  tower: 5,
  netcam: 2.6,
  stand: 4.2,
  crane: 4.4,
  celebration: 2.4,
  orbit: 2.6,
};

export function Rig({
  sim,
  mode: requestedMode,
  goalPulse,
  goalFocus,
  reducedMotion = false,
}: {
  sim: SimView;
  mode: CameraMode;
  goalPulse: React.MutableRefObject<number>;
  goalFocus: GoalFocusRef;
  reducedMotion?: boolean;
}) {
  const mode = accessibleMatchCamera(requestedMode, reducedMotion);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  const anchor = useMemo(() => new THREE.Vector2(), []); // bola com zona morta
  const hold = useRef(new ShotHold<ShotId>("wide"));
  const initialized = useRef(false);
  const state = useRef({ shot: "wide" as ShotId, since: 0, prev: "wide" as ShotId, cut: 0 });

  useFrame(({ camera, clock }, dtRaw) => {
    const dt = Math.min(0.05, dtRaw); // trava picos de frame para não dar solavanco
    const s = state.current;
    s.since += dt;
    s.cut = Math.max(0, s.cut - dt);

    const visualBall = presentationBall(sim);
    const pulse = reducedMotion ? 0 : goalPulse.current;
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
    const f = framingFor(s.shot, ctx, reducedMotion ? 0 : clock.elapsedTime);
    pos.set(f.px, f.py, f.pz);
    // Nenhum modo manual coloca a lente abaixo do gramado, mesmo após o shake.
    pos.y = Math.max(2.1, pos.y);
    if (s.shot !== "stand") keepPitchCameraInRunoff(pos, FIELD_X, FIELD_Z);
    look.set(f.lx, f.ly, f.lz);

    // tremor discreto só em comemoração/perigo, com amplitude limitada
    if (pulse > 0.05) {
      const amp = Math.min(0.45, pulse * 0.5);
      pos.x += Math.sin(clock.elapsedTime * 19) * amp;
      pos.y += Math.cos(clock.elapsedTime * 15) * amp * 0.5;
    }

    // amortecimento por tempo real + limite de velocidade linear
    const closeShot = s.shot === "duel" || s.shot === "playercam" || s.shot === "celebration";
    const base = reducedMotion
      ? 0.8
      : s.cut > 0
        ? 0.18
        : closeShot
          ? 0.3
          : s.shot === "skycam"
            ? 0.7
            : 0.55;
    // Start at the selected shot, rather than flying from the Canvas default
    // through the roof and grass while startup frames are still expensive.
    const firstFrame = !initialized.current;
    if (firstFrame) camera.position.copy(pos);
    else easing.damp3(camera.position, pos, base, dt);
    // Also constrain the interpolated lens when a low shot changes touchline.
    if (s.shot !== "stand") keepPitchCameraInRunoff(camera.position, FIELD_X, FIELD_Z);
    if (firstFrame) smoothLook.copy(look);
    else easing.damp3(smoothLook, look, s.cut > 0 ? 0.16 : 0.3, dt);
    camera.lookAt(smoothLook);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      const horizontalFov = f.fov - pulse * 2;
      const wantFov = framingFov(horizontalFov, cam.aspect, s.shot === "tower");
      if (Math.abs(cam.fov - wantFov) > 0.01) {
        cam.fov = firstFrame ? wantFov : cam.fov + (wantFov - cam.fov) * (1 - Math.exp(-dt * 3.2));
        cam.updateProjectionMatrix();
      }
    }
    initialized.current = true;
  });
  return null;
}

/* --------------------------------------------------------- pós-processamento */

/** Céu com degradê, nuvens volumosas, estrelas e sol/lua; gira bem devagar. */
