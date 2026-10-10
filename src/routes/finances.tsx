import { gamePageHead } from "@/lib/game-page-metadata";
import { createFileRoute } from "@tanstack/react-router";

import { GameShell } from "@/components/game/GameShell";
import { NoCareer, ScreenHeader, StatStrip } from "@/components/game/screen-kit";
import { CLUBS } from "@/game/data/leagues";
import { formatMoney } from "@/game/economy";
import {
  OPERATING_PLAN_PRESETS,
  operatingPlanFor,
  projectWeeklyFinance,
  updateOperatingPlan,
} from "@/game/finance-forecast";
import { useCareer } from "@/hooks/useCareer";
import { supporterClimate, supporterOccupancy, worldFor } from "@/game/career-world";
import { computeTable } from "@/game/season";
import { financialChange, financeLedgerFor } from "@/game/financial-inputs";

export const Route = createFileRoute("/finances")({
  ssr: false,
  head: () => gamePageHead("/finances"),
  component: FinancesPage,
});

function FinancesPage() {
  const { career, update } = useCareer();
  if (!career) return <NoCareer />;

  const club = CLUBS[career.clubId]!;
  const table = computeTable(career);
  const position = table.findIndex((row) => row.clubId === career.clubId) + 1 || career.objective;
  const forecast = projectWeeklyFinance(career, { position, won: false, homeGame: true });
  const plan = operatingPlanFor(career);
  const expansionCost = Math.round((career.capacity / 1000) * 0.6 * 10) / 10;

  const setTicket = (price: number) =>
    update({ ...career, ticketPrice: Math.max(15, Math.min(140, price)) });

  const expand = () => {
    const finances = financialChange(career, 0, expansionCost);
    if (!finances || finances.budget < 0 || career.capacity + 5000 > 1_000_000) return;
    update({
      ...career,
      capacity: career.capacity + 5000,
      finances,
      financeLedger: [
        {
          id: `stadium-${career.season}-${career.round}-${career.capacity}`,
          season: career.season,
          round: career.round,
          kind: "infraestrutura" as const,
          label: "Ampliação do estádio",
          income: 0,
          expense: expansionCost,
        },
        ...financeLedgerFor(career),
      ].slice(0, 96),
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
    ["Folha salarial", `${formatMoney(forecast.costs.wages)}/sem`],
    ["Custo do staff", `${formatMoney(forecast.costs.staff)}/sem`],
    [
      "Patrocínio e comercial",
      `${formatMoney(forecast.revenue.sponsor + forecast.revenue.commercial)}/rodada`,
    ],
    [
      "Bilheteria e dia de jogo",
      `${formatMoney(forecast.revenue.ticketing + forecast.revenue.matchday)}/jogo em casa`,
    ],
    [
      "Público estimado",
      `${Math.round(career.capacity * supporterOccupancy(career)).toLocaleString("pt-BR")} pessoas`,
    ],
    ["Clima da torcida", supporterClimate(career)],
    ["Capacidade", career.capacity.toLocaleString("pt-BR")],
  ];

  const balance = forecast.net;

  return (
    <GameShell career={career}>
      <ScreenHeader
        title="Finanças do clube"
        eyebrow="Gestão do orçamento"
        description="Acompanhe o caixa, os custos da equipe e a receita do seu estádio."
      />
      <StatStrip
        stats={[
          {
            label: "Caixa disponível",
            value: formatMoney(career.finances.budget),
            hint: "Orçamento atual do clube",
          },
          {
            label: "Receitas",
            value: formatMoney(career.finances.income),
            hint: "Acumulado na temporada",
          },
          {
            label: "Despesas",
            value: formatMoney(career.finances.spent),
            hint: "Acumulado na temporada",
          },
          {
            label: "Saldo estimado",
            value: formatMoney(balance),
            hint: "Projeção de uma rodada em casa",
          },
        ]}
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg">Custos e receitas recorrentes</h2>
          <dl className="mt-4 divide-y divide-border/40 text-sm">
            {rows.slice(3).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg">Bilheteria e estádio</h2>
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
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {worldFor(career).fans.lastReaction} A confiança, a cobrança e o preço do ingresso
            entram na estimativa de público.
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

      <section className="mt-5 rounded-2xl border border-border/60 surface-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Plano operacional</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Base, medicina, scouting e comercial entram no caixa da rodada e mudam a evolução e a
              prevenção de lesões.
            </p>
          </div>
          <p
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              forecast.risk === "estável"
                ? "bg-emerald-500/15 text-emerald-500"
                : forecast.risk === "atenção"
                  ? "bg-amber-500/15 text-amber-500"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            Risco {forecast.risk}
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {OPERATING_PLAN_PRESETS.map((preset) => {
            const selected = Object.entries(preset.plan).every(
              ([key, value]) => plan[key as keyof typeof plan] === value,
            );
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => update(updateOperatingPlan(career, preset.plan))}
                aria-pressed={selected}
                className={`rounded-xl border p-3 text-left transition ${
                  selected ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"
                }`}
              >
                <p className="font-display text-sm uppercase tracking-wide">{preset.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Receita projetada" value={`${formatMoney(forecast.income)}/sem`} />
          <Metric label="Custo projetado" value={`${formatMoney(forecast.expense)}/sem`} />
          <Metric label="Folha / receita" value={`${Math.round(forecast.wageRatio * 100)}%`} />
          <Metric
            label="Fôlego de caixa"
            value={
              forecast.runwayWeeks === null
                ? "positivo"
                : `${Math.floor(forecast.runwayWeeks)} sem.`
            }
          />
        </div>
      </section>

      {(career.financeLedger ?? []).length > 0 ? (
        <section className="mt-5 rounded-2xl border border-border/60 surface-card p-5">
          <h2 className="font-display text-lg">Últimos lançamentos</h2>
          <ul className="mt-3 divide-y divide-border/40 text-sm">
            {(career.financeLedger ?? []).slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-muted-foreground">
                  T{entry.season} · R{entry.round} · {entry.label}
                </span>
                <span
                  className={
                    entry.income - entry.expense >= 0 ? "text-emerald-500" : "text-destructive"
                  }
                >
                  {entry.income - entry.expense >= 0 ? "+" : ""}
                  {formatMoney(entry.income - entry.expense)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </GameShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg">{value}</p>
    </div>
  );
}
