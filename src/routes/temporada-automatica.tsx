import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FastForward, Play, RotateCcw } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { autoSeason, autoWeek, type AutoWeek } from "@/game/autoplay";
import { prefersReducedMotion } from "@/game/device";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/temporada-automatica")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Temporada automática · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Deixe o computador jogar as partidas por você e acompanhe os resultados semana a semana.",
      },
      { property: "og:title", content: "Temporada automática · Pro Football Manager 3D" },
      { property: "og:description", content: "Simule a temporada inteira em segundos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AutoSeasonPage,
});

function AutoSeasonPage() {
  const { career, save } = useCareer();
  const [weeks, setWeeks] = useState<AutoWeek[]>([]);
  const [busy, setBusy] = useState(false);
  const calm = prefersReducedMotion();

  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  const runWeek = () => {
    setBusy(true);
    const w = autoWeek(career);
    if (w) {
      setWeeks((cur) => [w, ...cur].slice(0, 60));
      save(w.state);
    }
    setBusy(false);
  };

  const runSeason = () => {
    setBusy(true);
    const { weeks: ws, state } = autoSeason(career);
    if (ws.length) {
      setWeeks((cur) => [...[...ws].reverse(), ...cur].slice(0, 60));
      save(state);
    }
    setBusy(false);
  };

  const played = weeks.length;
  const wins = weeks.filter((w) => w.gf > w.ga).length;
  const draws = weeks.filter((w) => w.gf === w.ga).length;

  return (
    <GameShell career={career}>
      <header className="rounded-2xl border border-border/60 bg-card/70 p-5">
        <h1 className="font-display text-2xl uppercase tracking-wide">Temporada automática</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O computador escala o time, joga as partidas e devolve o resumo. Você continua no comando
          entre uma rodada e outra.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={runWeek}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-display text-sm uppercase tracking-wide text-primary-foreground disabled:opacity-50"
          >
            <Play size={16} /> Simular semana
          </button>
          <button
            onClick={runSeason}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 font-display text-sm uppercase tracking-wide disabled:opacity-50"
          >
            <FastForward size={16} /> Simular até o fim
          </button>
          {weeks.length ? (
            <button
              onClick={() => setWeeks([])}
              className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-4 py-2 text-sm text-muted-foreground"
            >
              <RotateCcw size={16} /> Limpar resumo
            </button>
          ) : null}
        </div>

        {played ? (
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
            {played} jogos · {wins} vitórias · {draws} empates · {played - wins - draws} derrotas
          </p>
        ) : null}
      </header>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {weeks.map((w, i) => {
          const club = CLUBS[w.opponentId];
          const win = w.gf > w.ga;
          const draw = w.gf === w.ga;
          return (
            <article
              key={`${w.round}-${w.opponentId}-${i}`}
              className={`rounded-2xl border p-4 ${calm ? "" : "animate-fade-in"} ${
                win
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : draw
                    ? "border-border/60 bg-card/70"
                    : "border-destructive/40 bg-destructive/10"
              }`}
              style={calm ? undefined : { animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <div className="flex items-center gap-3">
                {club ? <Crest club={club} size={30} detail="simple" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {w.home ? "vs" : "em"} {club?.name ?? w.opponentId}
                  </p>
                  <p className="text-xs text-muted-foreground">Rodada {w.round}</p>
                </div>
                <span className="font-display text-2xl tabular-nums">
                  {w.gf}–{w.ga}
                </span>
              </div>
              {w.scorers.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  ⚽ {w.scorers.map((s) => `${s.name}${s.goals > 1 ? ` (${s.goals})` : ""}`).join(", ")}
                </p>
              ) : null}
            </article>
          );
        })}
        {!weeks.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma rodada simulada ainda nesta sessão.
          </p>
        ) : null}
      </section>
    </GameShell>
  );
}
