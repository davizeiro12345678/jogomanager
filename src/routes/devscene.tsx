import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Stadium3D } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { buildSquad } from "@/game/squad";
import { MatchSim, type TeamSetup } from "@/game/sim";


export const Route = createFileRoute("/devscene")({ ssr: false, component: Dev });

function setup(id: string): TeamSetup {
  const c = CLUBS[id]!;
  return {
    clubId: c.id,
    name: c.name,
    short: c.short,
    primary: c.primary,
    secondary: c.secondary,
    players: buildSquad(c.id).slice(0, 11),
    tactics: { formation: "4-3-3", mentality: 2, pressing: 1, width: 1, tempo: 1 },
  };
}

function Dev() {
  const sim = useMemo(() => new MatchSim(setup("fla"), setup("pal"), "dev"), []);
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      sim.step(0.1);
      setT((n) => n + 1);
    }, 100);
    return () => clearInterval(i);
  }, [sim]);
  return (
    <div className="fixed inset-0">
      <Stadium3D sim={sim} mode="broadcast" quality="alta" />
    </div>
  );
}
