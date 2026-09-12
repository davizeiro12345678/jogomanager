import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney, wageBill } from "@/game/economy";
import { gateIncome, staffBill } from "@/game/events";
import { useCareer } from "@/hooks/useCareer";

export const Route = createFileRoute("/finances")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Finanças do clube · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Finanças do clube · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      { property: "og:description", content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancesPage,
});

function FinancesPage() {
  const { career, update } = useCareer();
  if (!career)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );

  const club = CLUBS[career.clubId]!;
  const players = Object.values(career.players);
  const wages = wageBill(players);
  const gate = gateIncome(career);
  const expansionCost = Math.round((career.capacity / 1000) * 0.6 * 10) / 10;

  const setTicket = (price: number) =>
    update({ ...career, ticketPrice: Math.max(15, Math.min(140, price)) });

  const expand = () => {
    if (career.finances.budget < expansionCost) return;
    update({
      ...career,
      capacity: career.capacity + 5000,
      finances: {
        ...career.finances,
        budget: Math.round((career.finances.budget - expansionCost) * 10) / 10,
        spent: Math.round((career.finances.spent + expansionCost) * 10) / 10,
      },
      news: [
        {
          id: `exp-${career.season}-${career.round}`,
          season: career.season,
          round: career.round,
          kind: "sistema" as const,
          title: "Estádio ampliado",
          body: `${club.name} agora comporta ${(career.capacity + 5000).toLocaleString("pt-BR")} torcedores.`,
        },
        ...career.news,
      ].slice(0, 60),
    });
  };

  const rows: [string, string][] = [
    ["Caixa", formatMoney(career.finances.budget)],
    ["Receitas na temporada", formatMoney(career.finances.income)],
    ["Gastos na temporada", formatMoney(career.finances.spent)],
    ["Folha salarial", `€${wages.toLocaleString("pt-BR")}k/sem`],
    ["Custo do staff", `${formatMoney(staffBill(career))}/sem`],
    ["Patrocínio", `${formatMoney(career.sponsor)}/rodada`],
    ["Bilheteria estimada", `${formatMoney(gate)}/jogo em casa`],
    ["Capacidade", career.capacity.toLocaleString("pt-BR")],
  ];

  const balance = career.sponsor + gate - wages / 1000 - staffBill(career);

  return (
    <GameShell career={career}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h1 className="font-display text-2xl uppercase tracking-wide">Finanças</h1>
          <dl className="mt-4 divide-y divide-border/40 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p
            className={`mt-3 font-display text-lg ${balance >= 0 ? "text-primary" : "text-destructive"}`}
          >
            Saldo semanal: {formatMoney(balance)}
          </p>
        </section>

        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-xl uppercase tracking-wide">Bilheteria e estádio</h2>
          <label htmlFor="ticket" className="mt-4 block text-sm text-muted-foreground">
            Preço do ingresso: €{career.ticketPrice}
          </label>
          <input
            id="ticket"
            type="range"
            min={15}
            max={140}
            step={5}
            value={career.ticketPrice}
            onChange={(e) => setTicket(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Preços altos aumentam a receita, mas irritam a torcida.
          </p>
          <button
            onClick={expand}
            disabled={career.finances.budget < expansionCost}
            className="mt-4 rounded-lg bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground disabled:opacity-40"
          >
            Ampliar +5.000 lugares ({formatMoney(expansionCost)})
          </button>
        </section>
      </div>
    </GameShell>
  );
}
