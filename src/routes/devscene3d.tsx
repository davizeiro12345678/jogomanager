import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useEffect, useState } from "react";

import { Stadium3D } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { MatchSim, type TeamSetup } from "@/game/sim";
import { buildSquad } from "@/game/squad";
import { pickLineup } from "@/game/career";
import type { Player } from "@/game/types";

export const Route = createFileRoute("/devscene3d")({ ssr: false, component: Dev });

function setup(clubId: string): TeamSetup {
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
  const ids = Object.keys(CLUBS);
  const sim = useMemo(() => new MatchSim(setup(ids[0]!), setup(ids[1]!), "dev"), []);
  const [, setT] = useState(0);
  useEffect(() => {
    let r = 0;
    const loop = () => {
      sim.step(0.05);
      setT((v) => v + 1);
      r = requestAnimationFrame(loop);
    };
    r = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(r);
  }, [sim]);
  return (
    <div className="h-screen w-screen">
      <Stadium3D sim={sim} mode="broadcast" quality="baixa" />
    </div>
  );
}
