import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Crest } from "@/components/game/Crest";
import { GameShell } from "@/components/game/GameShell";
import { acceptOffer, rejectOffer } from "@/game/career";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney, formatWage, wageBill } from "@/game/economy";
import { generateMarket, releasePlayer, signPlayer, type MarketEntry } from "@/game/transfers";
import { useCareer } from "@/hooks/useCareer";


export const Route = createFileRoute("/transfers")({
  head: () => ({
    meta: [
      { title: "Mercado de transferências · Manager 3D" },
      {
        name: "description",
        content: "Contrate reforços, gerencie o orçamento e libere jogadores do elenco.",
      },
      { property: "og:title", content: "Mercado de transferências · Manager 3D" },
      { property: "og:description", content: "Reforce seu elenco dentro do orçamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransfersPage,
});

function TransfersPage() {
  const { career, update } = useCareer();
  const [filter, setFilter] = useState<string>("ALL");

  const market = useMemo(
    () => (career ? generateMarket(`${career.clubId}-s${career.season}-r${career.round}`) : []),
    [career],
  );

  if (!career) return <Empty />;

  const players = Object.values(career.players);
  const bill = wageBill(players);
  const filtered =
    filter === "ALL" ? market : market.filter((m: MarketEntry) => m.pos === filter);

  return (
    <GameShell career={career}>
      {career.offers.length > 0 ? (
        <section className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Clubes interessados</h2>
          <ul className="mt-3 space-y-2">
            {career.offers.map((o) => {
              const p = career.players[o.playerId];
              const c = CLUBS[o.clubId];
              if (!p || !c) return null;
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
                >
                  <Crest club={c} size={34} />
                  <div>
                    <p className="text-sm font-medium">
                      {c.name} quer {p.name} ({p.pos} · {p.ovr})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Proposta {formatMoney(o.amount)} · salário oferecido {formatWage(o.wage)} ·
                      expira na rodada {o.expiresRound}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => update(acceptOffer(career, o.id))}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs uppercase tracking-wider text-primary-foreground"
                    >
                      Vender
                    </button>
                    <button
                      onClick={() => update(rejectOffer(career, o.id))}
                      className="rounded-md bg-secondary px-3 py-1.5 text-xs uppercase tracking-wider"
                    >
                      Recusar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">

        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl uppercase tracking-wide">Mercado da bola</h1>
            <span className="ml-auto rounded-lg bg-secondary px-3 py-1 font-display text-sm">
              Caixa: <span className="text-primary">{formatMoney(career.finances.budget)}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Novas ofertas a cada rodada. Folha atual: {formatWage(bill)}/semana.
          </p>

          <div className="mt-3 flex gap-1" role="tablist" aria-label="Filtrar por posição">
            {["ALL", "GK", "DF", "MF", "FW"].map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs uppercase tracking-wider transition ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary hover:brightness-125"
                }`}
              >
                {f === "ALL" ? "Todos" : f}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Jogador</th>
                  <th className="p-2">Pos</th>
                  <th className="p-2">Idade</th>
                  <th className="p-2">OVR</th>
                  <th className="p-2">Preço</th>
                  <th className="p-2">Salário</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: MarketEntry) => {
                  const affordable = career.finances.budget >= m.price;
                  const signed = Boolean(career.players[`free-${m.key}`]);
                  return (
                    <tr key={m.key} className="border-t border-border/40">
                      <td className="p-2">
                        {m.name}
                        <div className="text-[10px] text-muted-foreground">{m.fromLeague}</div>
                      </td>
                      <td className="p-2 text-center text-muted-foreground">{m.pos}</td>
                      <td className="p-2 text-center">{m.age}</td>
                      <td className="p-2 text-center font-display text-base">{m.ovr}</td>
                      <td className="p-2 text-center">{formatMoney(m.price)}</td>
                      <td className="p-2 text-center text-xs text-muted-foreground">
                        {formatWage(m.wage)}
                      </td>
                      <td className="p-2 text-right">
                        {signed ? (
                          <span className="rounded bg-primary/20 px-2 py-1 text-[10px] uppercase text-primary">
                            Contratado
                          </span>
                        ) : (
                          <button
                            disabled={!affordable}
                            onClick={() => update(signPlayer(career, m))}
                            className="rounded-md bg-primary px-3 py-1.5 font-display text-xs uppercase tracking-wider text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Contratar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/70 p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Dispensar jogador</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rescisão amigável custa 20% do valor de mercado. Elenco mínimo: 16 atletas.
          </p>
          <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto text-sm">
            {players
              .slice()
              .sort((a, b) => a.ovr - b.ovr)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2"
                >
                  <span>
                    <span className="text-muted-foreground">{p.pos}</span> {p.name}
                    <span className="ml-2 font-display">{p.ovr}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatWage(p.wage)}
                    </span>
                  </span>
                  <button
                    onClick={() => update(releasePlayer(career, p.id))}
                    className="rounded-md bg-destructive/20 px-2.5 py-1 text-[10px] uppercase tracking-wider text-destructive transition hover:bg-destructive/30"
                  >
                    Dispensar
                  </button>
                </li>
              ))}
          </ul>
        </section>
      </div>
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
