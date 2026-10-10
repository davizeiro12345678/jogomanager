import {
  ScreenHeader,
  EmptyState,
  ErrorPanel,
  SkeletonRows,
  StatStrip,
} from "@/components/game/screen-kit";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";
import { useCareer } from "@/hooks/useCareer";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { getPurchases, type PurchaseRow } from "@/lib/purchases.functions";
import { track } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withPaymentTimeout } from "@/lib/embedded-checkout";

export const Route = createFileRoute("/compras")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Minhas compras · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte o histórico das suas compras, pagamentos e itens adquiridos para acompanhar a entrega na sua conta.",
      },
      {
        property: "og:title",
        content: "Minhas compras · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte o histórico das suas compras, pagamentos e itens adquiridos para acompanhar a entrega na sua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComprasPage,
});

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

function ComprasPage() {
  const userId = useAuthUserId();
  const signedIn = userId === undefined ? null : userId !== null;
  const { career } = useCareer();
  const fetchPurchases = useServerFn(getPurchases);

  const query = useQuery({
    queryKey: ["purchases", userId],
    enabled: signedIn === true,
    queryFn: () => withPaymentTimeout(fetchPurchases()),
    refetchInterval: (q) => ((q.state.data?.pendingCount ?? 0) > 0 ? 5000 : false),
  });

  useEffect(() => {
    if (signedIn) track("painel_compras_visto");
  }, [signedIn]);

  const data = query.data;

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
        ) : query.isError ? (
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
                  { label: "Total gasto", value: money(data?.totalSpentCents ?? 0) },
                  { label: "Compras entregues", value: String(data?.completedCount ?? 0) },
                  { label: "Pendentes", value: String(data?.pendingCount ?? 0) },
                  { label: "Saldo de moedas", value: String(data?.coins ?? 0) },
                ]}
              />
            </div>

            {data?.seasonPass ? (
              <p className="mt-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                Passe de temporada ativo na sua conta.
              </p>
            ) : null}

            {(data?.pendingCount ?? 0) > 0 && (
              <p className="mt-4 rounded-xl border border-border/60 surface-card px-4 py-3 text-xs text-muted-foreground">
                Uma compra está sendo confirmada pelo banco. A entrega costuma levar poucos segundos
                — esta página atualiza sozinha.
              </p>
            )}

            <h2 className="mt-8 font-display text-sm uppercase tracking-wide">Histórico</h2>
            {data && data.purchases.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {data.purchases.map((p) => (
                  <PurchaseLine key={p.id} purchase={p} />
                ))}
              </ul>
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
          </>
        )}
      </div>
    </GameShell>
  );
}
