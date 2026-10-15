import { gamePageHead } from "@/lib/game-page-metadata";
import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { NoCareer, ScreenHeader } from "@/components/game/screen-kit";
import { CompetitionRules } from "@/components/game/CompetitionRules";
import { LeagueStandings } from "@/components/game/LeagueStandings";
import { HudCard, HudChip, HudStat, SparkBars, Sparkline, toneFor } from "@/components/ui/hud";

import { CLUBS, getLeague } from "@/game/data/leagues";
import { computeTable, roundFixtures } from "@/game/season";
import { pyramidZones } from "@/game/pyramid";
import { calendarYear } from "@/game/competition-regulations";
import { useCareer } from "@/hooks/useCareer";
import { Flag } from "@/components/game/Flag";

export const Route = createFileRoute("/league")({
  ssr: false,
  head: () => gamePageHead("/league"),
  component: LeaguePage,
});

function LeaguePage() {
  const { career } = useCareer();
  if (!career) return <NoCareer />;

  const league = getLeague(career.leagueId);
  const table = computeTable(career);
  const fixtures = roundFixtures(career, career.round);
  const lastRound = career.round > 1 ? roundFixtures(career, career.round - 1) : [];

  const zones = pyramidZones(
    career.leagueId,
    table.length,
    career.pyramidSlots,
    career.calendarYear ?? career.season,
  );

  const zoneOf = (index: number): "acesso" | "rebaixamento" | null => {
    const zone = zones[index];
    return zone === "acesso" || zone === "rebaixamento" ? zone : null;
  };

  const myIndex = table.findIndex((r) => r.clubId === career.clubId);
  const myRow = myIndex >= 0 ? table[myIndex] : undefined;
  const pos = myIndex + 1;
  const played = myRow ? myRow.p : 0;
  const efficiency = played > 0 && myRow ? (myRow.pts / (played * 3)) * 100 : 0;
  const myZone = myIndex >= 0 ? zoneOf(myIndex) : null;

  // histórico do clube para os gráficos de campanha
  const mine = career.results.filter((r) => r.home === career.clubId || r.away === career.clubId);
  const recent = mine.slice(-10).map((r) => {
    const home = r.home === career.clubId;
    return { gf: home ? r.hg : r.ag, ga: home ? r.ag : r.hg };
  });
  const pointsSeries = recent.map(({ gf, ga }) => (gf > ga ? 3 : gf === ga ? 1 : 0));
  let acc = 0;
  const cumulative = pointsSeries.map((p) => (acc += p));
  const goalsSeries = recent.map((r) => r.gf);

  return (
    <GameShell career={career}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <ScreenHeader
            title={
              <>
                <Flag league={league.id} country={league.country} size={28} /> {league.name}
              </>
            }
          />
          <p className="hud-num mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {calendarYear(career)} · Temporada {career.season} · Rodada {career.round}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {table.length} clubes nesta temporada ·{" "}
            {Math.max(0, ...career.fixtures.map((f) => f.round))} rodadas
          </p>
          {career.catalogCalendarPending && (
            <p className="mt-1 text-xs text-muted-foreground">
              A composição atualizada será aplicada na próxima temporada para preservar os
              resultados deste save.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <HudStat
            label="Posição"
            value={pos > 0 ? `${pos}º` : "—"}
            hint={
              myZone === "acesso"
                ? "Zona de acesso"
                : myZone === "rebaixamento"
                  ? "Zona de rebaixamento"
                  : `Objetivo ${career.objective}º`
            }
            tone={
              myZone === "rebaixamento"
                ? "bad"
                : pos > 0 && pos <= career.objective
                  ? "good"
                  : "warn"
            }
          />
          <HudStat label="Pontos" value={myRow ? myRow.pts : "—"} hint={`${played} jogos`} />
          <HudStat
            label="Aproveitamento"
            value={`${Math.round(efficiency)}%`}
            tone={toneFor(efficiency, { good: 60, warn: 40 })}
          />
          <HudStat
            label="Saldo"
            value={
              myRow
                ? myRow.gf - myRow.ga > 0
                  ? `+${myRow.gf - myRow.ga}`
                  : myRow.gf - myRow.ga
                : "—"
            }
            hint={myRow ? `${myRow.gf} pró · ${myRow.ga} contra` : ""}
          />
        </div>
      </div>

      <CompetitionRules career={career} />

      <div className="mt-4 grid items-start gap-4 hud-stagger xl:grid-cols-[minmax(0,1fr)_290px]">
        <LeagueStandings career={career} table={table} />

        <div className="space-y-4">
          <HudCard
            title="Sua campanha"
            tone={toneFor(efficiency, { good: 60, warn: 40 })}
            badge={<HudChip>últimos {recent.length || 0} jogos</HudChip>}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pontos acumulados
            </p>
            <Sparkline data={cumulative} width={260} height={56} className="w-full" />
            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Gols marcados por jogo
            </p>
            <SparkBars data={goalsSeries} height={48} />
          </HudCard>

          <HudCard
            title={`Rodada ${career.round}`}
            badge={<HudChip>{fixtures.length} jogos</HudChip>}
          >
            <ul className="space-y-2 text-sm">
              {fixtures.map((f) => (
                <li
                  key={`${f.home}-${f.away}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-foreground/[0.03] px-3 py-2 ${
                    f.home === career.clubId || f.away === career.clubId ? "border-primary/50" : ""
                  }`}
                >
                  <span className="flex-1 truncate">{CLUBS[f.home]?.short}</span>
                  <span className="hud-num rounded-md border border-border px-2 py-0.5 text-xs font-bold">
                    {f.homeGoals === null ? "x" : `${f.homeGoals} - ${f.awayGoals}`}
                  </span>
                  <span className="flex-1 truncate text-right">{CLUBS[f.away]?.short}</span>
                </li>
              ))}
            </ul>
          </HudCard>

          {lastRound.length > 0 && (
            <HudCard title={`Resultados da rodada ${career.round - 1}`}>
              <ul className="space-y-2 text-sm">
                {lastRound.map((f) => (
                  <li
                    key={`last-${f.home}-${f.away}`}
                    className="rounded-lg border border-border/50 bg-foreground/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 truncate">{CLUBS[f.home]?.short}</span>
                      <span className="hud-num rounded-md border border-border px-2 py-0.5 text-xs font-bold">
                        {f.homeGoals ?? "-"} - {f.awayGoals ?? "-"}
                      </span>
                      <span className="flex-1 truncate text-right">{CLUBS[f.away]?.short}</span>
                    </div>
                    {f.events && f.events.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {f.events.map((e, i) => (
                          <li key={i} className={e.side === "away" ? "ml-auto" : ""}>
                            <span className="hud-num">{e.minute}&apos;</span>{" "}
                            {e.kind === "vermelho" ? (
                              <span
                                className="inline-block h-2.5 w-2 rounded-[1px] bg-destructive align-middle"
                                aria-label="Cartão vermelho"
                              />
                            ) : e.kind === "penalti" ? (
                              "Gol (pên.)"
                            ) : e.kind === "gol_contra" ? (
                              "Gol contra"
                            ) : (
                              "Gol"
                            )}{" "}
                            <span className="opacity-70">{CLUBS[f[e.side]]?.short}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </HudCard>
          )}
        </div>
      </div>
    </GameShell>
  );
}
