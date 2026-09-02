import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Stadium3D, type CameraMode } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { MatchSim, type TeamSetup } from "@/game/sim";
import { pickLineup } from "@/game/career";
import { buildSquad } from "@/game/squad";
import type { Player } from "@/game/types";

export const Route = createFileRoute("/devscene")({ ssr: false, component: Dev });

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
  const [mode] = useState<CameraMode>("broadcast");
  const sim = useMemo(() => {
    const ids = Object.keys(CLUBS);
    const s = new MatchSim(team(ids[0]!), team(ids[1]!), "dev");
    for (let i = 0; i < 200; i++) s.step(1 / 30);
    return s;
  }, []);
  return (
    <div className="h-screen w-screen">
      <Stadium3D sim={sim} mode={mode} quality="alta" />
    </div>
  );
}
