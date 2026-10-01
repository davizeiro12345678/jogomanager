import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { CameraMode } from "@/game/camera-modes";
import { GRAPHICS_PROFILES } from "@/game/contracts/graphics-profile";
import { allocateHeroes, nonHeroDraws } from "@/game/draw-budget";
import type { RuntimeSceneBudget } from "@/game/runtime-scene-budget";
import type { SimView } from "@/game/sim";
import { gkKitFor, type Kit } from "@/game/kits";
import { PlayerRig } from "./PlayerRig";
import { LowPlayers } from "./LowPlayers";

/** Full articulated geometry is mounted only for visible, nearby athletes.
 * Distant athletes share the existing instance batches, including contact shadows.
 *
 * Quantos atletas ganham o rig completo não é um número fixo: o custo por herói
 * é conhecido (`HERO_MESH_COST`) e o teto de desenhos do tier também, então a
 * quantidade é derivada do que sobrou depois dos subsistemos medidos. Subir
 * heróis sem essa conta foi o que estourou o orçamento de Alta no passado. */
export function MatchPlayers({
  sim,
  homeKit,
  awayKit,
  goalPulse,
  quality,
  mode,
  replay,
  budget,
}: {
  sim: SimView;
  homeKit: Kit;
  awayKit: Kit;
  goalPulse: React.MutableRefObject<number>;
  quality: "alta" | "media" | "baixa";
  mode: CameraMode;
  replay: boolean;
  budget: Pick<RuntimeSceneBudget, "heroPlayers" | "replayHeroPlayers" | "tier">;
}) {
  const [near, setNear] = useState<ReadonlySet<string>>(new Set());
  const [heroLimit, setHeroLimit] = useState(() =>
    quality === "baixa" ? 0 : replay ? budget.replayHeroPlayers : budget.heroPlayers,
  );
  const timer = useRef(1);
  const drawTimer = useRef(0);
  const point = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  // histerese para subir heróis: só aumenta depois de 3 amostras seguidas
  const headroom = useRef(0);

  useFrame(({ camera, gl }, dt) => {
    // ---- orçamento medido: quantos heróis cabem no que sobrou
    drawTimer.current += dt;
    if (drawTimer.current >= 0.5) {
      drawTimer.current = 0;
      const base = quality === "baixa" ? 0 : replay ? budget.replayHeroPlayers : budget.heroPlayers;
      if (base > 0) {
        const maxDraws = GRAPHICS_PROFILES[budget.tier].maxDrawCalls;
        const measured = gl.info.render.calls;
        const wanted = allocateHeroes(maxDraws, nonHeroDraws(measured, near.size), base, 1).count;
        if (wanted < heroLimit) {
          headroom.current = 0;
          setHeroLimit(wanted);
        } else if (wanted > heroLimit) {
          headroom.current += 1;
          if (headroom.current >= 3) {
            headroom.current = 0;
            setHeroLimit(Math.min(wanted, base));
          }
        } else {
          headroom.current = 0;
        }
      } else if (heroLimit !== 0) {
        headroom.current = 0;
        setHeroLimit(0);
      }
    }

    timer.current += dt;
    if (timer.current < 0.32) return;
    timer.current = 0;
    const next = new Set<string>();
    const wideMode = mode === "tactical" || mode === "skycam" || mode === "fan";
    const maxDetailed =
      quality === "baixa" || wideMode
        ? 0
        : Math.min(heroLimit, replay ? budget.replayHeroPlayers : budget.heroPlayers);

    if (maxDetailed > 0) {
      camera.getWorldDirection(direction.current);
      const perspective = camera as THREE.PerspectiveCamera;
      const lens = perspective.isPerspectiveCamera
        ? 1 / Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5))
        : 1;
      const candidates = sim.players
        .filter((player) => !player.sentOff)
        .map((player) => {
          point.current.set(player.x, 1.05, player.z);
          const distance = point.current.distanceTo(camera.position);
          const inFront =
            direction.current.dot(point.current.sub(camera.position).normalize()) > 0.1;
          // Approximate vertical screen coverage. This follows the current lens
          // and retains a small hysteresis for an athlete already promoted.
          const coverage = inFront ? (1.78 * lens) / Math.max(1, distance) : 0;
          return { player, coverage };
        });
      candidates.sort((a, b) => b.coverage - a.coverage);
      for (const { player, coverage } of candidates) {
        const threshold = near.has(player.id) ? 0.035 : 0.052;
        if (coverage >= threshold && next.size < maxDetailed) next.add(player.id);
      }
    }
    if (next.size !== near.size || [...next].some((id) => !near.has(id))) setNear(next);
  });
  return (
    <>
      <LowPlayers
        sim={sim}
        homeKit={homeKit}
        awayKit={awayKit}
        homeGkKit={gkKitFor(sim.home.clubId)}
        awayGkKit={gkKitFor(sim.away.clubId)}
        excluded={near}
        simplified
      />
      {sim.players
        .filter((player) => !player.sentOff && quality !== "baixa" && near.has(player.id))
        .map((player) => (
          <PlayerRig
            key={player.id}
            player={player}
            sim={sim}
            kit={
              player.pos === "GK"
                ? gkKitFor(player.side === "home" ? sim.home.clubId : sim.away.clubId)
                : player.side === "home"
                  ? homeKit
                  : awayKit
            }
            goalPulse={goalPulse}
            quality={quality}
          />
        ))}
    </>
  );
}
