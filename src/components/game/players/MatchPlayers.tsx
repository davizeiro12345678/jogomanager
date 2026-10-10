import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CameraMode } from "@/game/camera-modes";
import { GRAPHICS_PROFILES } from "@/game/contracts/graphics-profile";
import { allocateHeroes } from "@/game/draw-budget";
import { denseMatchRig, legacyMatchRigRequested } from "@/game/match-rig-detail";
import { createNonHeroDrawCounter } from "@/game/scene-census";
import { HeroSelectionBuffer, stageHeroMembership, heroPriorityScore } from "@/game/hero-selection";
import type { RuntimeSceneBudget } from "@/game/runtime-scene-budget";
import type { SimView } from "@/game/sim";
import { goalPresentationFor, type GoalFocusRef } from "@/game/goal-choreography";
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
  goalFocus,
  quality,
  mode,
  replay,
  budget,
}: {
  sim: SimView;
  homeKit: Kit;
  awayKit: Kit;
  goalPulse: React.MutableRefObject<number>;
  goalFocus: GoalFocusRef;
  quality: "alta" | "media" | "baixa";
  mode: CameraMode;
  replay: boolean;
  budget: Pick<RuntimeSceneBudget, "heroPlayers" | "replayHeroPlayers" | "tier">;
}) {
  const [near, setNear] = useState<ReadonlySet<string>>(new Set());
  const [dense, setDense] = useState<ReadonlySet<string>>(new Set());
  const legacyTopology = useMemo(
    () =>
      typeof location !== "undefined" &&
      legacyMatchRigRequested(location.pathname, location.search),
    [],
  );
  const [heroLimit, setHeroLimit] = useState(() =>
    quality === "baixa" ? 0 : replay ? budget.replayHeroPlayers : budget.heroPlayers,
  );
  const timer = useRef(0);
  const firstDraw = useRef(false);
  const drawTimer = useRef(0);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const visibility = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      frustum: new THREE.Frustum(),
      bounds: new THREE.Sphere(new THREE.Vector3(), 1.5),
    }),
    [],
  );
  const selection = useMemo(() => new HeroSelectionBuffer(), []);
  const countNonHeroDraws = useMemo(createNonHeroDrawCounter, []);
  const homeGkKit = useMemo(() => gkKitFor(sim.home.clubId), [sim.home.clubId]);
  const awayGkKit = useMemo(() => gkKitFor(sim.away.clubId), [sim.away.clubId]);
  // histerese para subir heróis: só aumenta depois de 3 amostras seguidas
  const headroom = useRef(0);

  useFrame(({ camera, scene }, dt) => {
    // Let the instanced team complete one draw before mounting detailed rigs.
    if (!firstDraw.current) {
      firstDraw.current = true;
      return;
    }
    // ---- orçamento medido: quantos heróis cabem no que sobrou
    drawTimer.current += dt;
    if (drawTimer.current >= 0.5) {
      drawTimer.current = 0;
      const base = quality === "baixa" ? 0 : replay ? budget.replayHeroPlayers : budget.heroPlayers;
      if (base > 0) {
        const maxDraws = GRAPHICS_PROFILES[budget.tier].maxDrawCalls;
        // Renderer counters can be reset by post-processing or FrameProbe.
        // Measure actual non-player surfaces instead of treating zero as headroom.
        const otherDraws = countNonHeroDraws(scene);
        const wanted = allocateHeroes(maxDraws, otherDraws, base, 1).count;
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
    if (timer.current < 0.12) return;
    timer.current = 0;
    selection.reset();
    const denseCandidates = new Set<string>();
    const wideMode = mode === "tactical" || mode === "skycam" || mode === "fan";
    const maxDetailed =
      quality === "baixa" || wideMode
        ? 0
        : Math.min(heroLimit, replay ? budget.replayHeroPlayers : budget.heroPlayers);

    if (maxDetailed > 0) {
      visibility.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      visibility.frustum.setFromProjectionMatrix(visibility.matrix);
      camera.getWorldDirection(direction);
      const perspective = camera as THREE.PerspectiveCamera;
      const lens = perspective.isPerspectiveCamera
        ? 1 / Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5))
        : 1;
      for (let index = 0; index < sim.players.length; index += 1) {
        const player = sim.players[index]!;
        if (player.sentOff) continue;
        const presentation = goalPresentationFor(player, goalFocus.current, goalPulse.current);
        visibility.bounds.center.set(
          presentation?.rootX ?? player.x,
          1.05,
          presentation?.rootZ ?? player.z,
        );
        if (!visibility.frustum.intersectsSphere(visibility.bounds)) continue;
        const dx = (presentation?.rootX ?? player.x) - camera.position.x;
        const dy = 1.05 - camera.position.y;
        const dz = (presentation?.rootZ ?? player.z) - camera.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const inFront = direction.x * dx + direction.y * dy + direction.z * dz > distance * 0.1;
        // Approximate vertical screen coverage. This follows the current lens
        // and retains a small hysteresis for an athlete already promoted.
        const coverage = inFront ? (1.78 * lens) / Math.max(1, distance) : 0;
        if (denseMatchRig(coverage, dense.has(player.id))) denseCandidates.add(player.id);
        const progress = player.actionDur > 0 ? 1 - player.actionT / player.actionDur : 0;
        const actionLive = player.actionT > 0;
        const priority = heroPriorityScore(coverage, {
          retained: near.has(player.id),
          ballHolder: sim.ball.holder === player.id,
          contact:
            actionLive &&
            progress >= 0.2 &&
            progress <= 0.8 &&
            /^(pass|shoot|shot|cross|tackle|header|volley|trap|dribble)/.test(player.action ?? ""),
          keeperSave:
            actionLive &&
            player.pos === "GK" &&
            /^(dive|save|catch|punch|claim)/.test(player.action ?? ""),
          scorer: goalPulse.current > 0.01 && player.id === goalFocus.current?.scorerId,
        });
        if (priority !== null) selection.add(index, priority, maxDetailed);
      }
    }
    let changed = selection.count !== near.size;
    for (let index = 0; index < selection.count && !changed; index += 1)
      changed = !near.has(sim.players[selection.indices[index]!]!.id);
    // Allocate a React snapshot only when membership really changes.
    if (changed) {
      const desired: string[] = [];
      for (let index = 0; index < selection.count; index += 1)
        desired.push(sim.players[selection.indices[index]!]!.id);
      setNear(stageHeroMembership(near, desired));
    }
    // Only mounted heroes can consume dense geometry. Changes to offscreen
    // or unselected candidates must not reconcile the player tree.
    for (const id of denseCandidates) {
      let selected = false;
      for (let index = 0; index < selection.count; index++)
        if (sim.players[selection.indices[index]!]!.id === id) selected = true;
      if (!selected) denseCandidates.delete(id);
    }
    let denseChanged = denseCandidates.size !== dense.size;
    if (!denseChanged)
      for (const id of denseCandidates)
        if (!dense.has(id)) {
          denseChanged = true;
          break;
        }
    if (denseChanged) setDense(denseCandidates);
  });
  return (
    <>
      <LowPlayers
        sim={sim}
        homeKit={homeKit}
        awayKit={awayKit}
        homeGkKit={homeGkKit}
        awayGkKit={awayGkKit}
        goalPulse={goalPulse}
        goalFocus={goalFocus}
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
                ? player.side === "home"
                  ? homeGkKit
                  : awayGkKit
                : player.side === "home"
                  ? homeKit
                  : awayKit
            }
            goalPulse={goalPulse}
            goalFocus={goalFocus}
            quality={quality}
            denseGeometry={legacyTopology || dense.has(player.id)}
            matchTopology={!legacyTopology}
          />
        ))}
    </>
  );
}
