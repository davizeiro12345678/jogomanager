import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { SimView } from "@/game/sim";
import { gkKitFor, type Kit } from "@/game/kits";
import { PlayerRig } from "./PlayerRig";
import { LowPlayers } from "./LowPlayers";

/** Full articulated geometry is mounted only for visible, nearby athletes.
 * Distant athletes share the existing instance batches, including contact shadows. */
export function MatchPlayers({ sim, homeKit, awayKit, goalPulse, quality }: {
  sim: SimView; homeKit: Kit; awayKit: Kit; goalPulse: React.MutableRefObject<number>; quality: "alta" | "media" | "baixa";
}) {
  const [near, setNear] = useState<ReadonlySet<string>>(new Set());
  const timer = useRef(1);
  useFrame(({ camera }, dt) => {
    timer.current += dt;
    if (timer.current < 0.25) return;
    timer.current = 0;
    const next = new Set<string>();
    if (quality !== "baixa") {
      const candidates = sim.players.map(player => ({ player, distance: Math.hypot(player.x - camera.position.x, camera.position.y - 1, player.z - camera.position.z) }));
      candidates.sort((a, b) => a.distance - b.distance);
      for (const { player, distance } of candidates) {
        const limit = (quality === "alta" ? 48 : 29) + (near.has(player.id) ? 7 : 0);
        const maxDetailed = quality === "alta" ? 8 : 4;
        if (distance < limit && next.size < maxDetailed) next.add(player.id);
      }
    }
    if (next.size !== near.size || [...next].some(id => !near.has(id))) setNear(next);
  });
  return <>
    <LowPlayers sim={sim} homeKit={homeKit} awayKit={awayKit} homeGkKit={gkKitFor(sim.home.clubId)} awayGkKit={gkKitFor(sim.away.clubId)} excluded={near} simplified />
    {sim.players.filter(player => near.has(player.id)).map(player => <PlayerRig key={player.id} player={player} sim={sim} kit={player.pos === "GK" ? gkKitFor(player.side === "home" ? sim.home.clubId : sim.away.clubId) : player.side === "home" ? homeKit : awayKit} goalPulse={goalPulse} quality={quality} />)}
  </>;
}
