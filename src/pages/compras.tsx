import {
  EmptyState,
  ErrorPanel,
  ScreenHeader,
  SkeletonRows,
  StatStrip,
} from "@/components/game/screen-kit";

import { Link } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { useServerFn } from "@tanstack/react-start";

import { useEffect, useState } from "react";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";

import { useCareer } from "@/hooks/useCareer";

import { useAuthUserId } from "@/hooks/useAuthUserId";

import { getPurchases, type PurchaseRow } from "@/lib/purchases.functions";

import { track } from "@/lib/analytics";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { withPaymentTimeout } from "@/lib/embedded-checkout";

const PURCHASE_FILTERS = {
  all: "Todas",
  pending: "Em processamento",
  completed: "Entregues",
  failed: "Não concluídas",
  review: "Reembolsos em revisão",
} as const;

const PRODUCT_NAMES: Record<string, string> = {
  coins_starter: "Punhado de moedas",
  coins_small: "Bolsa de moedas",
  coins_medium: "Cofre de moedas",
  coins_large: "Baú de moedas",
  scout_pack: "Pacote de olheiro",
  training_pack: "Treino intensivo",
  theme_pack: "Temas e escudos",
  celebration_pack: "Pacote de comemorações",
  stadium_pack: "Pacote de estádio",
  season_pass_monthly: "Passe de temporada",
  season_pass: "Passe de temporada",
};

function money(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge className="gap-1">
        <CheckCircle2 size={12} /> Entregue
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock size={12} /> Processando
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle size={12} /> Não concluída
    </Badge>
  );
}

function PurchaseLine({ purchase }: { purchase: PurchaseRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 surface-card px-4 py-3">
      <div className="min-w-0">
        <p className="font-display text-sm uppercase tracking-wide">
          {PRODUCT_NAMES[purchase.productKey] ?? purchase.productKey}
        </p>
        <p className="text-xs text-muted-foreground">{when(purchase.createdAt)}</p>
        {purchase.error ? <p className="mt-1 text-xs text-destructive">{purchase.error}</p> : null}
        {purchase.paymentReview === "refund_review" ? (
          <p className="mt-2 max-w-lg text-xs text-muted-foreground">
            Reembolso registrado para revisão
            {purchase.refundedAmountCents ? `: ${money(purchase.refundedAmountCents)}` : ""}. Os
            benefícios já entregues permanecem na sua conta.
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-sm">{money(purchase.amountCents)}</span>
        <StatusBadge status={purchase.status} />
      </div>
    </li>
  );
}

export function ComprasPage() {
  const userId = useAuthUserId();
  const signedIn = userId === undefined ? null : userId !== null;
  const { career } = useCareer();
  const fetchPurchases = useServerFn(getPurchases);
  const [filter, setFilter] = useState<keyof typeof PURCHASE_FILTERS>("all");

  const query = useQuery({
    queryKey: ["purchases", userId],
    enabled: signedIn === true,
    queryFn: () => withPaymentTimeout(fetchPurchases()),
    staleTime: 20_000,
    refetchInterval: ({ state }) =>
      state.data?.purchases.some(
        (row) => row.status === "pending" && Date.now() - Date.parse(row.createdAt) < 5 * 60_000,
      )
        ? 15_000
        : false,
  });

  useEffect(() => {
    if (signedIn) track("painel_compras_visto");
  }, [signedIn]);

  const data = query.data;
  const visible =
    data?.purchases.filter(
      (purchase) =>
        filter === "all" ||
        (filter === "review"
          ? purchase.paymentReview === "refund_review"
          : purchase.status === filter),
    ) ?? [];

  return (
    <GameShell career={career}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <ScreenHeader title="Minhas compras" />
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo o que você comprou, o que já foi entregue e o que ainda está sendo confirmado.
        </p>

        {signedIn === false ? (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/85 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para ver o histórico de compras.
            </p>
            <Link
              to="/auth"
              search={{ next: "/compras" }}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
            >
              Entrar
            </Link>
          </div>
        ) : query.isLoading || signedIn === null ? (
          <div className="mt-6">
            <SkeletonRows rows={4} label="Carregando compras" />
          </div>
        ) : query.isError && !data ? (
          <div className="mt-6">
            <ErrorPanel
              hint="Não foi possível carregar suas compras agora."
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <StatStrip
                stats={[
                  { label: "Total no histórico", value: money(data?.totalSpentCents ?? 0) },
                  { label: "Compras entregues", value: String(data?.completedCount ?? 0) },
                  { label: "Pendentes", value: String(data?.pendingCount ?? 0) },
                  { label: "Saldo de moedas", value: String(data?.coins ?? 0) },
                ]}
              />
            </div>

            {data?.seasonPass ? (
              <p className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                Passe de temporada ativo
                {data.seasonPassUntil ? (
                  <>
                    {" "}
                    até <time dateTime={data.seasonPassUntil}>{when(data.seasonPassUntil)}</time>
                  </>
                ) : null}
                .
              </p>
            ) : null}

            {(data?.pendingCount ?? 0) > 0 && (
              <p className="mt-4 rounded-xl border border-border/60 surface-card px-4 py-3 text-xs text-muted-foreground">
                O pagamento ou a entrega ainda está em processamento. Compras recentes são
                verificadas automaticamente. Você também pode atualizar agora.
              </p>
            )}

            <section aria-labelledby="purchase-history-title" className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="purchase-history-title"
                    className="font-display text-sm uppercase tracking-wide"
                  >
                    Histórico
                  </h2>
                  <p className="text-sm text-muted-foreground">Até 100 compras recentes.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {query.isFetching ? "Consultando…" : "Atualizar histórico"}
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label htmlFor="purchase-filter">Filtrar por situação</label>
                <select
                  id="purchase-filter"
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as keyof typeof PURCHASE_FILTERS)
                  }
                  className="min-h-11 max-w-full rounded-md border border-input bg-background px-3"
                >
                  {Object.entries(PURCHASE_FILTERS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground" role="status">
                  {visible.length} {visible.length === 1 ? "compra exibida" : "compras exibidas"}
                </p>
              </div>
              {query.isRefetchError ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  A atualização falhou. Exibindo a última consulta concluída.
                </p>
              ) : null}
              {visible.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {visible.map((p) => (
                    <PurchaseLine key={p.id} purchase={p} />
                  ))}
                </ul>
              ) : filter !== "all" && data?.purchases.length ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nenhuma compra com essa situação.
                </p>
              ) : (
                <EmptyState
                  title="Nenhuma compra neste histórico"
                  hint="Veja os pacotes e cosméticos disponíveis para seu clube."
                  action={
                    <Button asChild>
                      <Link to="/loja">Ver a loja</Link>
                    </Button>
                  }
                />
              )}
            </section>
          </>
        )}
      </div>
    </GameShell>
  );
}
