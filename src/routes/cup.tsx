import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { groupTable, nextPhaseName, stageName } from "@/game/cup";
import { useCareer } from "@/hooks/useCareer";
import type { CupState, CupTie } from "@/game/types";

export const Route = createFileRoute("/cup")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Copas e torneios · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Copas e torneios · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CupPage,
});

function CupPage() {
  const { career } = useCareer();
  if (!career) return <Empty />;
  const cups = career.cups ?? [];

  return (
    <GameShell career={career}>
      <h1 className="font-display text-2xl uppercase tracking-wide">Copas e torneios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        As fases eliminatórias acontecem entre as rodadas da liga. Vencer rende premiação e troféu.
      </p>

      {cups.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border/60 surface-card p-5 text-sm text-muted-foreground">
          O sorteio das copas acontece assim que a primeira rodada da temporada for disputada.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {cups.map((cup) => (
            <CupCard key={cup.id} cup={cup} clubId={career.clubId} />
          ))}
        </div>
      )}
    </GameShell>
  );
}

function CupCard({ cup, clubId }: { cup: CupState; clubId: string }) {
  const status = cup.winner
    ? cup.winner === clubId
      ? "Campeão! 🏆"
      : `Campeão: ${CLUBS[cup.winner]?.name ?? "—"}`
    : cup.out
      ? "Eliminado"
      : `Próxima fase: ${nextPhaseName(cup)}`;

  const stages = [...new Set(cup.ties.map((t) => t.round))].sort((a, b) => a - b);

  return (
    <section className="rounded-2xl border border-border/60 surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg uppercase tracking-wide">{cup.name}</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider ${
            cup.winner === clubId
              ? "bg-yellow-500/15 text-yellow-500"
              : cup.out
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/15 text-primary"
          }`}
        >
          {status}
        </span>
      </div>

      {cup.groups?.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cup.groups.map((g) => (
            <div key={g.label} className="rounded-xl bg-secondary/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Grupo {g.label}
              </p>
              <table className="mt-1.5 w-full text-sm">
                <thead className="text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left font-normal">Clube</th>
                    <th className="w-8 font-normal">J</th>
                    <th className="w-8 font-normal">SG</th>
                    <th className="w-8 font-normal">P</th>
                  </tr>
                </thead>
                <tbody>
                  {groupTable(g).map((r, i) => (
                    <tr
                      key={r.clubId}
                      className={
                        r.clubId === clubId
                          ? "bg-primary/10"
                          : i < 2
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }
                    >
                      <td className="truncate py-0.5">
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className={`h-3 w-1 rounded-full ${i < 2 ? "bg-primary" : "bg-transparent"}`}
                          />
                          {CLUBS[r.clubId]?.short ?? r.clubId}
                        </span>
                      </td>
                      <td className="text-center tabular-nums">{r.p}</td>
                      <td className="text-center tabular-nums">{r.gf - r.ga}</td>
                      <td className="text-center font-display tabular-nums">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {stages.map((s) => (
          <div key={s}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {stageName(s)}
            </p>
            <ul className="mt-1.5 space-y-1">
              {cup.ties
                .filter((t) => t.round === s)
                .map((t, i) => (
                  <TieRow key={`${s}-${i}`} tie={t} clubId={clubId} />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function TieRow({ tie, clubId }: { tie: CupTie; clubId: string }) {
  const home = CLUBS[tie.home];
  const away = CLUBS[tie.away];
  const mine = tie.home === clubId || tie.away === clubId;
  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
        mine ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/40"
      }`}
    >
      {home ? <Crest club={home} size={18} detail="simple" /> : null}
      <span className="min-w-0 flex-1 truncate">{home?.name ?? "A definir"}</span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {tie.hg === null ? "–" : `${tie.hg} x ${tie.ag}`}
      </span>
      <span className="min-w-0 flex-1 truncate text-right">{away?.name ?? "A definir"}</span>
      {away ? <Crest club={away} size={18} detail="simple" /> : null}
    </li>
  );
}

function Empty() {
  return (
    <GameShell career={null}>
      <p className="text-sm text-muted-foreground">Comece uma carreira para disputar as copas.</p>
    </GameShell>
  );
}
