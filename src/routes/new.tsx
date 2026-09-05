import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { LEAGUES, getLeague } from "@/game/data/leagues";
import { initCareer } from "@/game/career";
import { Crest } from "@/components/game/Crest";
import { useCareer } from "@/hooks/useCareer";
import { loadRealSquad } from "@/lib/realSquads";
import { Flag } from "@/components/game/Flag";

export const Route = createFileRoute("/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Escolher clube · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Escolha a liga e o clube que você vai comandar nesta temporada.",
      },
      { property: "og:title", content: "Escolher clube · Pro Football Manager 3D" },
      { property: "og:description", content: "80 clubes reais em 4 grandes ligas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewCareer,
});

function NewCareer() {
  const navigate = useNavigate();
  const { update } = useCareer();
  const [leagueId, setLeagueId] = useState(LEAGUES[0]!.id);
  const [manager, setManager] = useState("Técnico");
  const league = getLeague(leagueId);

  const [loadingClub, setLoadingClub] = useState<string | null>(null);

  async function start(clubId: string) {
    setLoadingClub(clubId);
    // Busca o elenco real do clube antes de montar a carreira.
    await loadRealSquad(clubId);
    update(initCareer(leagueId, clubId, manager.trim() || "Técnico"));
    navigate({ to: "/club" });
  }

  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-4xl uppercase tracking-wide">Nova carreira</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha a liga, informe seu nome e assuma o comando de um clube.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor="manager-name" className="sr-only">Seu nome de técnico</label>
          <input
            id="manager-name"
            aria-label="Seu nome de técnico"
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            placeholder="Seu nome"
            className="rounded-lg border border-input bg-card/70 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                onClick={() => setLeagueId(l.id)}
                className={`rounded-lg border px-3 py-2 font-display text-sm uppercase tracking-wide transition ${
                  l.id === leagueId
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Flag league={l.id} size={18} /> {l.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {league.clubs.map((c) => (
            <button
              key={c.id}
              onClick={() => void start(c.id)}
              disabled={loadingClub !== null}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3 text-left backdrop-blur transition hover:border-primary hover:bg-card"
            >
              <Crest club={c} size={40} />
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-tight">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {loadingClub === c.id ? "Carregando elenco real…" : `Força ${c.strength}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
