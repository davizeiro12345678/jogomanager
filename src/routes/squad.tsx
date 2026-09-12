import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PlayerSheet } from "@/components/game/PlayerSheet";

import { GameShell } from "@/components/game/GameShell";
import { HudBar, HudCard, HudChip, HudRing, HudStat, SparkBars, toneFor } from "@/components/ui/hud";
import { FORMATIONS } from "@/game/formations";
import { formatMoney, formatWage, wageBill } from "@/game/economy";
import { useCareer } from "@/hooks/useCareer";
import type { Player } from "@/game/types";

export const Route = createFileRoute("/squad")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Elenco e escalação · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Elenco e escalação · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  component: SquadPage,
});

function statusBadge(p: Player) {
  if (p.injuryWeeks > 0)
    return (
      <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
        Lesionado {p.injuryWeeks}r
      </span>
    );
  if (p.suspended)
    return (
      <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] uppercase text-amber-400">
        Suspenso
      </span>
    );
  return null;
}

function SquadPage() {
  const { career, update } = useCareer();
  const [sheet, setSheet] = useState<Player | null>(null);
  if (!career) return <Empty />;

  const players = Object.values(career.players);
  const slots = FORMATIONS[career.tactics.formation];
  const lineup = career.lineup.map((id) => career.players[id]).filter(Boolean) as Player[];
  const reserves = players.filter((p) => !career.lineup.includes(p.id));

  function swap(outId: string, inId: string) {
    if (!career) return;
    const idx = career.lineup.indexOf(outId);
    if (idx < 0) return;
    const lineupNext = [...career.lineup];
    lineupNext[idx] = inId;
    update({
      ...career,
      lineup: lineupNext,
      bench: career.bench.map((b) => (b === inId ? outId : b)),
    });
  }

  const avgOvr = players.reduce((s, p) => s + p.ovr, 0) / Math.max(1, players.length);
  const avgAge = players.reduce((s, p) => s + p.age, 0) / Math.max(1, players.length);
  const avgCondition = players.reduce((s, p) => s + p.condition, 0) / Math.max(1, players.length);
  const avgMorale = players.reduce((s, p) => s + p.morale, 0) / Math.max(1, players.length);
  const injured = players.filter((p) => p.injuryWeeks > 0).length;
  const suspended = players.filter((p) => p.suspended).length;
  const week = wageBill(players);
  const conditionTone = toneFor(avgCondition, { good: 82, warn: 65 });
  const ageBuckets = [
    players.filter((p) => p.age <= 21).length,
    players.filter((p) => p.age >= 22 && p.age <= 25).length,
    players.filter((p) => p.age >= 26 && p.age <= 29).length,
    players.filter((p) => p.age >= 30).length,
  ];

  return (
    <GameShell career={career}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide sm:text-4xl">Elenco</h1>
          <p className="hud-num mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {players.length} jogadores · Formação {career.tactics.formation}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <HudStat label="OVR médio" value={Math.round(avgOvr)} tone={toneFor(avgOvr)} />
          <HudStat label="Idade média" value={avgAge.toFixed(1)} />
          <HudStat
            label="Condição"
            value={`${Math.round(avgCondition)}%`}
            tone={conditionTone}
            hint={`${injured} lesionados · ${suspended} suspensos`}
          />
          <HudStat label="Folha" value={`€${week.toLocaleString("pt-BR")}k/sem`} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 hud-stagger sm:grid-cols-3">
        <HudCard title="Condição do grupo" tone={conditionTone} bodyClassName="flex justify-center">
          <HudRing value={avgCondition} label="condição" sub={`${injured} lesionados`} />
        </HudCard>
        <HudCard title="Faixa etária" badge={<HudChip>{players.length} atletas</HudChip>}>
          <SparkBars data={ageBuckets} height={72} />
          <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>≤21</span>
            <span>22–25</span>
            <span>26–29</span>
            <span>30+</span>
          </div>
        </HudCard>
        <HudCard title="Vestíário" bodyClassName="space-y-5 pt-1">
          <HudBar label="Moral média" value={avgMorale} tone={toneFor(avgMorale)} />
          <HudBar label="Condição média" value={avgCondition} tone={conditionTone} />
        </HudCard>
      </div>

      <div className="mt-4 grid items-start gap-4 hud-stagger lg:grid-cols-[1.1fr_1fr]">
        <HudCard
          title={`Escalação · ${career.tactics.formation}`}
          badge={<HudChip>{lineup.length}/11</HudChip>}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/60 bg-[linear-gradient(180deg,#12452a,#0e3a23)]">
            <div className="absolute inset-x-6 inset-y-4 rounded-md border border-white/25" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
            {lineup.map((p, i) => {
              const slot = slots[i];
              if (!slot) return null;
              return (
                <div
                  key={p.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{
                    left: `${50 + slot.z * 40}%`,
                    top: `${50 - slot.x * 42}%`,
                  }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground shadow">
                    {p.number}
                  </span>
                  <span className="mt-1 max-w-20 truncate rounded bg-black/60 px-1 text-[10px] text-white">
                    {p.name.split(" ").slice(-1)[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </HudCard>

        <HudCard
          title="Plantel"
          tone={injured + suspended >= 4 ? "bad" : injured + suspended >= 2 ? "warn" : "good"}
          badge={<HudChip>{reserves.length} reservas</HudChip>}
        >
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-card/95 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                <tr>
                  <th className="p-2 text-left">Jogador</th>
                  <th className="p-2">Pos</th>
                  <th className="p-2">OVR</th>
                  <th className="p-2">Cond</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2"></th>
                </tr>
              </thead>

              <tbody>
                {[...lineup, ...reserves].map((p) => {
                  const starting = career!.lineup.includes(p.id);
                  const unavailable = p.injuryWeeks > 0 || p.suspended;
                  const condTone = toneFor(p.condition, { good: 80, warn: 60 });
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-border/40 transition-colors hover:bg-foreground/[0.04] ${
                        starting ? "bg-primary/[0.06]" : ""
                      }`}
                    >
                      <td className="p-2">
                        {p.photo ? (
                          <img
                            src={p.photo}
                            alt=""
                            loading="lazy"
                            className="mr-2 inline-block h-7 w-7 rounded-full object-cover align-middle ring-1 ring-border/60"
                          />
                        ) : null}
                        <span className="hud-num text-muted-foreground">{p.number} </span>
                        <button
                          type="button"
                          onClick={() => setSheet(p)}
                          className="text-left font-semibold underline-offset-2 hover:text-primary hover:underline"
                        >
                          {p.name}
                        </button>

                        {p.yellows > 0 ? (
                          <span
                            className="ml-1 text-[10px] text-amber-400"
                            title={`${p.yellows} cartão(ões) amarelo(s)`}
                          >
                            {"🟨".repeat(p.yellows)}
                          </span>
                        ) : null}
                        <div className="mt-0.5 flex gap-1">{statusBadge(p)}</div>
                      </td>
                      <td className="p-2 text-center">
                        <span className="hud-num rounded-md border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {p.pos}
                        </span>
                      </td>
                      <td className="hud-num p-2 text-center font-bold">{p.ovr}</td>
                      <td className="p-2">
                        <div
                          className={
                            condTone === "good"
                              ? "tone-good"
                              : condTone === "warn"
                                ? "tone-warn"
                                : "tone-bad"
                          }
                        >
                          <div className="hud-bar">
                            <div className="hud-bar-fill" style={{ width: `${p.condition}%` }} />
                          </div>
                          <p className="hud-num mt-1 text-center text-[10px] font-bold text-tone">
                            {p.condition}%
                          </p>
                        </div>
                      </td>
                      <td className="hud-num p-2 text-center text-xs text-muted-foreground">
                        {formatMoney(p.value)}
                        <div className="text-[10px]">{formatWage(p.wage)}</div>
                      </td>
                      <td className="p-2 text-right">
                        {starting ? (
                          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                            Titular
                          </span>
                        ) : unavailable ? (
                          statusBadge(p)
                        ) : (
                          <select
                            aria-label={`Substituir titular por ${p.name}`}
                            className="min-h-[36px] rounded-lg border border-input bg-background/60 px-2 text-xs"
                            value=""
                            onChange={(e) => e.target.value && swap(e.target.value, p.id)}
                          >
                            <option value="">Entrar por…</option>
                            {lineup.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </HudCard>
      </div>
      {sheet ? <PlayerSheet player={sheet} onClose={() => setSheet(null)} /> : null}
    </GameShell>
  );
}

function Empty() {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Nenhuma carreira ativa.
    </div>
  );
}
