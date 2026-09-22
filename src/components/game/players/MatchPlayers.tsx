import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { CameraMode } from "@/game/camera-modes";
import type { RuntimeSceneBudget } from "@/game/runtime-scene-budget";
import type { SimView } from "@/game/sim";
import { gkKitFor, type Kit } from "@/game/kits";
import { PlayerRig } from "./PlayerRig";
import { LowPlayers } from "./LowPlayers";

/** Full articulated geometry is mounted only for visible, nearby athletes.
 * Distant athletes share the existing instance batches, including contact shadows. */
export function MatchPlayers({ sim, homeKit, awayKit, goalPulse, quality, mode, replay, budget }: {
  sim: SimView;
  homeKit: Kit;
  awayKit: Kit;
  goalPulse: React.MutableRefObject<number>;
  quality: "alta" | "media" | "baixa";
  mode: CameraMode;
  replay: boolean;
  budget: Pick<RuntimeSceneBudget, "heroPlayers" | "replayHeroPlayers">;
}) {
  const [near, setNear] = useState<ReadonlySet<string>>(new Set());
  const timer = useRef(1);
  const point = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  useFrame(({ camera }, dt) => {
    timer.current += dt;
    if (timer.current < 0.32) return;
    timer.current = 0;
    const next = new Set<string>();
    const wideMode = mode === "tactical" || mode === "skycam" || mode === "fan";
    const maxDetailed = quality === "baixa" || wideMode
      ? 0
      : replay
        ? budget.replayHeroPlayers
        : budget.heroPlayers;

    if (maxDetailed > 0) {
      camera.getWorldDirection(direction.current);
      const perspective = camera as THREE.PerspectiveCamera;
      const lens = perspective.isPerspectiveCamera
        ? 1 / Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5))
        : 1;
      const candidates = sim.players.map((player) => {
          point.current.set(player.x, 1.05, player.z);
          const distance = point.current.distanceTo(camera.position);
          const inFront = direction.current.dot(point.current.sub(camera.position).normalize()) > 0.1;
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
    if (next.size !== near.size || [...next].some(id => !near.has(id))) setNear(next);
  });
  return <>
    <LowPlayers sim={sim} homeKit={homeKit} awayKit={awayKit} homeGkKit={gkKitFor(sim.home.clubId)} awayGkKit={gkKitFor(sim.away.clubId)} excluded={near} simplified />
    {sim.players.filter(player => near.has(player.id)).map(player => <PlayerRig key={player.id} player={player} sim={sim} kit={player.pos === "GK" ? gkKitFor(player.side === "home" ? sim.home.clubId : sim.away.clubId) : player.side === "home" ? homeKit : awayKit} goalPulse={goalPulse} quality={quality} />)}
  </>;
}
