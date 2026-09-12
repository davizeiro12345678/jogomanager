import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { Crest } from "@/components/game/Crest";
import { HudCard, HudChip, HudStat, SparkBars, Sparkline, toneFor } from "@/components/ui/hud";

import { CLUBS, getLeague } from "@/game/data/leagues";
import { computeTable, roundFixtures } from "@/game/season";
import { PYRAMID, PYRAMID_UP, hasPyramid, slotsFor } from "@/game/pyramid";
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
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Tabela e calendário · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  component: LeaguePage,
});

function LeaguePage() {
  const { career, update } = useCareer();
  if (!career) return <div className="p-10 text-muted-foreground">Nenhuma carreira ativa.</div>;

  const league = getLeague(career.leagueId);
  const table = computeTable(career);
  const fixtures = roundFixtures(career, career.round);

  const linked = hasPyramid(career.leagueId);
  const topId = career.leagueId in PYRAMID ? career.leagueId : PYRAMID_UP[career.leagueId];
  const inTopDivision = career.leagueId in PYRAMID;
  const slots = linked && topId ? slotsFor(topId, career.pyramidSlots) : 0;
  const maxSlots = Math.max(1, Math.min(8, Math.floor(table.length / 2) || 1));

  const zoneOf = (index: number): "acesso" | "rebaixamento" | null => {
    if (!linked || slots <= 0) return null;
    if (inTopDivision) return index >= table.length - slots ? "rebaixamento" : null;
    return index < slots ? "acesso" : null;
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
          <h1 className="flex items-center gap-2 font-display text-3xl uppercase tracking-wide sm:text-4xl">
            <Flag league={league.id} size={28} /> {league.name}
          </h1>
          <p className="hud-num mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            Temporada {career.season} · Rodada {career.round}
          </p>
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

      {linked && (
        <HudCard title="Acesso e rebaixamento" tone="neutral" className="mt-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <p className="flex-1 text-muted-foreground">
              {inTopDivision
                ? `Os ${slots} últimos caem para a divisão de baixo no fim da temporada.`
                : `Os ${slots} primeiros sobem para a divisão de cima no fim da temporada.`}
            </p>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Vagas</span>
              <input
                type="number"
                min={1}
                max={maxSlots}
                value={slots}
                onChange={(e) => {
                  const next = Math.max(
                    1,
                    Math.min(maxSlots, Math.round(Number(e.target.value) || 1)),
                  );
                  update({ ...career, pyramidSlots: next });
                }}
                className="h-11 w-20 rounded-lg border border-border/60 bg-background px-3 text-center font-display"
                aria-label="Número de vagas de acesso e rebaixamento"
              />
            </label>
          </div>
        </HudCard>
      )}

      <div className="mt-4 grid items-start gap-4 hud-stagger lg:grid-cols-[1.4fr_1fr]">
        <HudCard
          title="Classificação"
          bodyClassName="-mx-4 -mb-4 overflow-hidden sm:-mx-5 sm:-mb-5"
        >
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.05] text-[10px] uppercase tracking-wider text-muted-foreground">
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
                const zone = zoneOf(i);
                return (
                  <tr
                    key={r.clubId}
                    className={`border-t border-border/40 transition-colors hover:bg-foreground/[0.04] ${
                      mine ? "bg-primary/10 font-semibold" : ""
                    }`}
                  >
                    <td className="hud-num p-2 text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`h-5 w-1 rounded-full ${
                            zone === "acesso"
                              ? "bg-primary"
                              : zone === "rebaixamento"
                                ? "bg-destructive"
                                : "bg-transparent"
                          }`}
                        />
                        <span className="sr-only">
                          {zone === "acesso"
                            ? "Zona de acesso."
                            : zone === "rebaixamento"
                              ? "Zona de rebaixamento."
                              : ""}
                        </span>
                        {i + 1}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="flex items-center gap-2">
                        <Crest club={club} size={20} />
                        <span className="truncate">{club.name}</span>
                      </span>
                    </td>
                    <td className="hud-num p-2 text-center text-muted-foreground">{r.p}</td>
                    <td className="hud-num p-2 text-center">{r.w}</td>
                    <td className="hud-num p-2 text-center">{r.d}</td>
                    <td className="hud-num p-2 text-center">{r.l}</td>
                    <td className="hud-num p-2 text-center">{r.gf - r.ga}</td>
                    <td className="hud-num p-2 text-center font-bold">{r.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </HudCard>

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
      </div>
    </GameShell>
  );
}
