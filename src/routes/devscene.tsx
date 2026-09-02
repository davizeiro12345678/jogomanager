import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Stadium3D } from "@/components/game/Stadium3D";
import { CLUBS } from "@/game/data/leagues";
import { generateSquad } from "@/game/squad";
import { MatchSim, type TeamSetup } from "@/game/sim";
import { DEFAULT_TACTICS } from "@/game/types";

export const Route = createFileRoute("/devscene")({ ssr: false, component: Dev });

function setup(id: string): TeamSetup {
  const c = CLUBS[id]!;
  return {
    clubId: c.id,
    name: c.name,
    short: c.short,
    primary: c.primary,
    secondary: c.secondary,
    players: generateSquad(c).slice(0, 11),
    tactics: DEFAULT_TACTICS,
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
