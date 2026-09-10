import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Coins, Clock, CheckCircle2, AlertTriangle, ShoppingBag } from "lucide-react";

import { GameShell } from "@/components/game/GameShell";
import { useSignedIn } from "@/hooks/useCareer";
import { getPurchases, type PurchaseRow } from "@/lib/purchases.functions";
import { track } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/compras")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Minhas compras · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Acompanhe o total gasto, as compras pendentes e o histórico completo dos seus pacotes.",
      },
      { property: "og:title", content: "Minhas compras · Pro Football Manager 3D" },
      {
        property: "og:description",
        content: "Total gasto, compras pendentes e histórico de pacotes.",
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
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
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
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/60 px-4 py-3">
      <div className="min-w-0">
        <p className="font-display text-sm uppercase tracking-wide">
          {PRODUCT_NAMES[purchase.productKey] ?? purchase.productKey}
        </p>
        <p className="text-xs text-muted-foreground">{when(purchase.createdAt)}</p>
        {purchase.error ? (
          <p className="mt-1 text-xs text-destructive">{purchase.error}</p>
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
  const signedIn = useSignedIn();
  const fetchPurchases = useServerFn(getPurchases);

  const query = useQuery({
    queryKey: ["purchases"],
    enabled: signedIn === true,
    queryFn: () => fetchPurchases(),
    refetchInterval: (q) => ((q.state.data?.pendingCount ?? 0) > 0 ? 5000 : false),
  });

  useEffect(() => {
    if (signedIn) track("painel_compras_visto");
  }, [signedIn]);

  const data = query.data;

  return (
    <GameShell>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">Minhas compras</h1>
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
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : query.isError ? (
          <div className="mt-6 rounded-2xl border border-destructive/40 bg-card/70 p-6">
            <p className="text-sm text-destructive">
              Não foi possível carregar suas compras agora.
            </p>
            <Button className="mt-3" onClick={() => void query.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Total gasto
                </p>
                <p className="font-display text-xl">{money(data?.totalSpentCents ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Compras
                </p>
                <p className="font-display text-xl">{data?.completedCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Pendentes
                </p>
                <p className="font-display text-xl">{data?.pendingCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Saldo
                </p>
                <p className="flex items-center gap-1 font-display text-xl">
                  <Coins size={16} className="text-primary" />
                  {data?.coins ?? 0}
                </p>
              </div>
            </div>

            {(data?.pendingCount ?? 0) > 0 && (
              <p className="mt-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
                Uma compra está sendo confirmada pelo banco. A entrega costuma levar poucos
                segundos — esta página atualiza sozinha.
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
              <div className="mt-3 rounded-2xl border border-border/60 bg-card/70 p-6 text-center">
                <ShoppingBag className="mx-auto mb-2 text-muted-foreground" size={24} />
                <p className="text-sm text-muted-foreground">
                  Você ainda não comprou nada. Os pacotes ajudam o clube sem mudar o resultado das
                  partidas.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/loja">Ver a loja</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </GameShell>
  );
}
