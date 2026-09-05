import { useMemo, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import type { MatchSim } from "@/game/sim";

type Tab = "resumo" | "notas" | "chutes" | "sumula";

/** Relatório completo de fim de jogo: notas, melhor em campo, mapa de chutes e súmula. */
export function MatchReport({
  sim,
  homeId,
  awayId,
  mySide,
  onFinish,
}: {
  sim: MatchSim;
  homeId: string;
  awayId: string;
  mySide: "home" | "away";
  onFinish: () => void;
}) {
  const [tab, setTab] = useState<Tab>("resumo");
  const ratings = useMemo(() => sim.playerRatings(), [sim]);
  const motm = useMemo(() => sim.manOfTheMatch(), [sim]);
  const home = CLUBS[homeId]!;
  const away = CLUBS[awayId]!;
  const [ph, pa] = sim.possessionPct();
  const mine = ratings
    .filter((r) => r.side === mySide)
    .sort((a, b) => b.rating - a.rating);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-3 backdrop-blur">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border/60 bg-card p-5">
        <p className="text-center font-display text-xs uppercase tracking-[0.3em] text-primary">
          Fim de jogo
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <Crest club={home} size={40} detail="simple" />
          <p className="font-display text-4xl tabular-nums">
            {sim.stats.home.goals} <span className="text-muted-foreground">x</span>{" "}
            {sim.stats.away.goals}
          </p>
          <Crest club={away} size={40} detail="simple" />
        </div>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {home.short} x {away.short}
        </p>

        {motm ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
            <div>
              <p className="font-display text-[10px] uppercase tracking-[0.25em] text-primary">
                Melhor em campo
              </p>
              <p className="mt-0.5 text-sm">
                {motm.name} · {motm.pos} · {motm.side === "home" ? home.short : away.short}
              </p>
            </div>
            <p className="font-display text-3xl tabular-nums">{motm.rating.toFixed(1)}</p>
          </div>
        ) : null}

        <div className="mt-4 flex gap-1 rounded-xl bg-secondary p-1 text-xs">
          {(
            [
              ["resumo", "Resumo"],
              ["notas", "Notas"],
              ["chutes", "Chutes"],
              ["sumula", "Súmula"],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg py-1.5 font-display uppercase tracking-wide transition ${
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === "resumo" ? (
            <div className="space-y-2">
              <Bar label="Posse" h={ph} a={pa} suffix="%" />
              <Bar label="Chutes" h={sim.stats.home.shots} a={sim.stats.away.shots} />
              <Bar label="No gol" h={sim.stats.home.onTarget} a={sim.stats.away.onTarget} />
              <Bar label="Faltas" h={sim.stats.home.fouls} a={sim.stats.away.fouls} />
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {sim.scorers.map((s, i) => (
                  <li key={i}>
                    {s.minute}' {s.name} ({s.side === "home" ? home.short : away.short})
                  </li>
                ))}
                {sim.scorers.length === 0 ? <li>Sem gols na partida.</li> : null}
              </ul>
            </div>
          ) : null}

          {tab === "notas" ? (
            <ul className="divide-y divide-border/50">
              {mine.map((r) => (
                <li key={r.pid} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-6 text-right font-display text-muted-foreground">
                    {r.number}
                  </span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="hidden w-40 gap-2 text-xs text-muted-foreground sm:flex">
                    <span>{r.goals}G</span>
                    <span>{r.assists}A</span>
                    <span>{r.passes}P</span>
                    <span>{r.tackles}D</span>
                    {r.pos === "GK" ? <span>{r.saves}S</span> : null}
                  </span>
                  <span
                    className={`w-11 rounded-md px-1 py-0.5 text-center font-display tabular-nums ${
                      r.rating >= 7.5
                        ? "bg-primary/20 text-primary"
                        : r.rating >= 6
                          ? "bg-secondary"
                          : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {r.rating.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "chutes" ? (
            <div>
              <div className="relative mx-auto aspect-[3/2] w-full overflow-hidden rounded-xl border border-border/60 bg-[linear-gradient(180deg,#14472c,#0d3521)]">
                <div className="absolute inset-x-3 inset-y-3 rounded border border-white/20" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                {sim.shotMap.map((s, i) => (
                  <span
                    key={i}
                    title={`${s.minute}' ${s.name}`}
                    className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                      s.result === "goal"
                        ? "bg-primary ring-2 ring-white"
                        : s.result === "saved"
                          ? "bg-amber-400"
                          : "bg-white/40"
                    }`}
                    style={{ left: `${50 + s.x * 0.9}%`, top: `${50 + s.z * 1.2}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Verde: gol · amarelo: defendido · cinza: para fora.
              </p>
            </div>
          ) : null}

          {tab === "sumula" ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {sim.events.map((e, i) => (
                <li key={i}>{e.text}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          onClick={onFinish}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 font-display text-sm uppercase tracking-widest text-primary-foreground"
        >
          Voltar à central
        </button>
      </div>
    </div>
  );
}

function Bar({ label, h, a, suffix = "" }: { label: string; h: number; a: number; suffix?: string }) {
  const total = Math.max(1, h + a);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="tabular-nums text-foreground">
          {h}
          {suffix}
        </span>
        <span>{label}</span>
        <span className="tabular-nums text-foreground">
          {a}
          {suffix}
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-secondary">
        <div className="bg-primary" style={{ width: `${(h / total) * 100}%` }} />
        <div className="ml-auto bg-muted-foreground/50" style={{ width: `${(a / total) * 100}%` }} />
      </div>
    </div>
  );
}
