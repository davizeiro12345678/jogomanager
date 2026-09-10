import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { computeTable, roundFixtures } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";
import { Flag } from "@/components/game/Flag";

export const Route = createFileRoute("/league")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Tabela e calendário · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Tabela e calendário · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      { property: "og:description", content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaguePage,
});

function LeaguePage() {
  const { career } = useCareer();
  if (!career) return <div className="p-10 text-muted-foreground">Nenhuma carreira ativa.</div>;

  const league = getLeague(career.leagueId);
  const table = computeTable(career);
  const fixtures = roundFixtures(career, career.round);

  return (
    <GameShell career={career}>
      <h1 className="font-display text-3xl uppercase tracking-wide">
        <Flag league={league.id} size={28} /> {league.name}
      </h1>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Clube</th>
                <th className="p-2">J</th>
                <th className="p-2">V</th>
                <th className="p-2">E</th>
                <th className="p-2">D</th>
                <th className="p-2">SG</th>
                <th className="p-2">P</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => {
                const club = CLUBS[r.clubId]!;
                const mine = r.clubId === career.clubId;
                return (
                  <tr
                    key={r.clubId}
                    className={`border-t border-border/40 ${mine ? "bg-primary/10" : ""}`}
                  >
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2">
                      <span className="flex items-center gap-2">
                        <Crest club={club} size={20} />
                        <span className="truncate">{club.name}</span>
                      </span>
                    </td>
                    <td className="p-2 text-center">{r.p}</td>
                    <td className="p-2 text-center">{r.w}</td>
                    <td className="p-2 text-center">{r.d}</td>
                    <td className="p-2 text-center">{r.l}</td>
                    <td className="p-2 text-center">{r.gf - r.ga}</td>
                    <td className="p-2 text-center font-display">{r.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-4">
          <h2 className="font-display text-lg uppercase tracking-wide">Rodada {career.round}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {fixtures.map((f) => (
              <li
                key={`${f.home}-${f.away}`}
                className="flex items-center justify-between border-b border-border/30 pb-1"
              >
                <span className="truncate">{CLUBS[f.home]?.short}</span>
                <span className="font-display text-muted-foreground">
                  {f.homeGoals === null ? "x" : `${f.homeGoals} - ${f.awayGoals}`}
                </span>
                <span className="truncate text-right">{CLUBS[f.away]?.short}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </GameShell>
  );
}
