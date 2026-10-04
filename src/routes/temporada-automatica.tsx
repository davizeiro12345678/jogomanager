import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FastForward, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { GameShell } from "@/components/game/GameShell";
import { NoCareer } from "@/components/game/screen-kit";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { type AutoWeek } from "@/game/autoplay";
import { autoSeasonAsync } from "@/game/simWorkerClient";
import { prefersReducedMotion } from "@/game/device";
import { useCareer } from "@/hooks/useCareer";
import { achievementById } from "@/game/achievements";

export const Route = createFileRoute("/temporada-automatica")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Temporada automática · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Configure a simulação automática e acompanhe o avanço das rodadas e o histórico de partidas da carreira.",
      },
      {
        property: "og:title",
        content: "Temporada automática · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Configure a simulação automática e acompanhe o avanço das rodadas e o histórico de partidas da carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AutoSeasonPage,
});

function notifyNewAchievements(before: string[] | undefined, after: string[] | undefined) {
  const prev = new Set(before ?? []);
  for (const id of after ?? []) {
    if (!prev.has(id)) {
      const a = achievementById(id);
      if (a) toast.success(`Conquista desbloqueada: ${a.title}`);
    }
  }
}

function AutoSeasonPage() {
  const { career, update } = useCareer();
  const [weeks, setWeeks] = useState<AutoWeek[]>([]);
  const [busy, setBusy] = useState(false);
  const calm = prefersReducedMotion();

  if (!career) return <NoCareer />;

  const runWeek = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { weeks: nextWeeks } = await autoSeasonAsync(career, 1);
      const w = nextWeeks[0];
      if (w) {
        setWeeks((cur) => [w, ...cur].slice(0, 60));
        notifyNewAchievements(career.achievements, w.state.achievements);
        update(w.state);
      }
    } catch {
      toast.error("Não foi possível simular a semana. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const runSeason = async () => {
    setBusy(true);
    try {
      const { weeks: ws, state } = await autoSeasonAsync(career);
      if (ws.length) {
        setWeeks((cur) => [...[...ws].reverse(), ...cur].slice(0, 60));
        notifyNewAchievements(career.achievements, state.achievements);
        update(state);
      }
    } catch {
      toast.error("Não foi possível simular a temporada. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const matches = weeks.filter((week) => week.kind === "match");
  const played = matches.length;
  const wins = matches.filter((w) => w.gf > w.ga).length;
  const draws = matches.filter((w) => w.gf === w.ga).length;

  return (
    <GameShell career={career}>
      <header className="rounded-2xl border border-border/60 surface-card p-5">
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
          const isBye = w.kind === "bye";
          const club = isBye ? undefined : CLUBS[w.opponentId];
          const win = !isBye && w.gf > w.ga;
          const draw = !isBye && w.gf === w.ga;
          return (
            <article
              key={`${w.round}-${w.opponentId}-${i}`}
              className={`rounded-2xl border p-4 ${calm ? "" : "animate-fade-in"} ${
                isBye
                  ? "border-border/40 surface-card opacity-80"
                  : win
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : draw
                      ? "border-border/60 surface-card"
                      : "border-destructive/40 bg-destructive/10"
              }`}
              style={calm ? undefined : { animationDelay: `${Math.min(i, 10) * 45}ms` }}
            >
              <div className="flex items-center gap-3">
                {club ? <Crest club={club} size={30} detail="simple" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {isBye
                      ? "Folga na rodada"
                      : `${w.home ? "vs" : "em"} ${club?.name ?? w.opponentId}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Rodada {w.round}</p>
                </div>
                {isBye ? null : (
                  <span className="font-display text-2xl tabular-nums">
                    {w.gf}–{w.ga}
                  </span>
                )}
              </div>
              {w.scorers.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  ⚽{" "}
                  {w.scorers
                    .map((s) => `${s.name}${s.goals > 1 ? ` (${s.goals})` : ""}`)
                    .join(", ")}
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
