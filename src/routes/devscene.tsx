import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Stadium3D } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { buildSquad } from "@/game/squad";
import { pickLineup } from "@/game/career";
import { MatchSim, type TeamSetup } from "@/game/sim";
import type { Player } from "@/game/types";

export const Route = createFileRoute("/devscene")({ component: Dev });

function team(clubId: string): TeamSetup {
  const club = CLUBS[clubId]!;
  const squad = buildSquad(clubId);
  const { lineup } = pickLineup(squad, "4-3-3");
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  return {
    clubId,
    name: club.name,
    short: club.short,
    primary: club.primary,
    secondary: club.secondary,
    players: lineup.map((id) => byId[id]!).filter(Boolean) as Player[],
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
  };
}

function Dev() {
  const sim = useMemo(() => {
    const ids = Object.keys(CLUBS);
    return new MatchSim(team(ids[0]!), team(ids[1]!), "dev");
  }, []);
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    const i = setInterval(() => {
      for (let k = 0; k < 6; k++) sim.step(1 / 30);
      setTick((v) => v + 1);
    }, 33);
    return () => clearInterval(i);
  }, [sim]);
  return (
    <div className="h-screen w-screen">
      {ready && <Stadium3D sim={sim} mode="fan" quality="alta" tick={tick} />}
    </div>
  );
}
