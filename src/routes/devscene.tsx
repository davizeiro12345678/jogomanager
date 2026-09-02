import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { Stadium3D } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { MatchSim } from "@/game/sim";
import { buildSquad } from "@/game/squad";

export const Route = createFileRoute("/devscene")({
  ssr: false,
  component: DevScene,
});

function DevScene() {
  const sim = useMemo(() => {
    const h = CLUBS["bra_flam"] ?? Object.values(CLUBS)[0]!;
    const a = CLUBS["bra_pal"] ?? Object.values(CLUBS)[1]!;
    return new MatchSim(
      {
        clubId: h.id,
        name: h.name,
        short: h.short,
        primary: h.primary,
        secondary: h.secondary,
        players: buildSquad(h.id).slice(0, 11),
        tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
      },
      {
        clubId: a.id,
        name: a.name,
        short: a.short,
        primary: a.primary,
        secondary: a.secondary,
        players: buildSquad(a.id).slice(0, 11),
        tactics: { formation: "4-4-2", mentality: 2, pressing: 1, width: 1, tempo: 1 },
      },
      "devscene",
    );
  }, []);

  return (
    <div className="h-screen w-screen bg-black">
      <Stadium3D sim={sim} mode="broadcast" quality="alta" />
    </div>
  );
}
