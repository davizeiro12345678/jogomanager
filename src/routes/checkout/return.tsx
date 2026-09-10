import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle, XCircle, Loader2, Coins } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { claimCheckoutSession } from "@/lib/checkout-claim.functions";
import { getPurchases } from "@/lib/purchases.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { track } from "@/lib/analytics";


export const Route = createFileRoute("/checkout/return")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Resultado do pagamento · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:title", content: "Resultado do pagamento · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        property: "og:description",
        content: "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => {
    const id = typeof search["session_id"] === "string" ? search["session_id"] : undefined;
    return id ? { session_id: id } : {};
  },
  component: CheckoutReturn,
});

const MAX_TRIES = 15; // ~30 segundos

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const fetchPurchases = useServerFn(getPurchases);
  const claimSession = useServerFn(claimCheckoutSession);
  const [status, setStatus] = useState<"loading" | "delivered" | "slow" | "error">(
    sessionId ? "loading" : "error",
  );
  const [coins, setCoins] = useState<number | null>(null);
  const tries = useRef(0);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const data = await fetchPurchases();
      setCoins(data.coins);
      const mine = data.purchases.find((p) => p.reference === sessionId);
      if (mine?.status === "completed") {
        setStatus("delivered");
        track("compra_concluida", { produto: mine.productKey });
        return true;
      }
      if (mine?.status === "failed") {
        setStatus("error");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchPurchases, sessionId]);


  useEffect(() => {
    if (!sessionId) return;
    let alive = true;

    // Confirma a compra direto na Stripe (o webhook pode atrasar ou não chegar).
    void (async () => {
      try {
        const res = await claimSession({
          data: { sessionId, environment: getStripeEnvironment() },
        });
        if (!alive) return;
        if (res.status === "delivered") await check();
      } catch {
        /* o polling abaixo ainda cobre o caminho do webhook */
      }
    })();

    const timer = setInterval(() => {
      void (async () => {
        if (!alive) return;
        tries.current += 1;
        const done = await check();
        if (done || tries.current >= MAX_TRIES) {
          clearInterval(timer);
          if (!done && alive) setStatus("slow");
        }
      })();
    }, 2000);
    void check();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sessionId, check, claimSession]);


  return (
    <div className="pitch-bg flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/90 p-6 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="font-display text-xl uppercase tracking-wide">Confirmando…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos creditando seus itens. Isso leva alguns segundos.
            </p>
          </>
        )}
        {status === "delivered" && (
          <>
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-green-500" />
            <h1 className="font-display text-xl uppercase tracking-wide">Tudo certo!</h1>
            <p className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Coins size={16} className="text-primary" />
              Saldo agora: <strong className="text-foreground">{coins ?? 0}</strong> moedas
            </p>
          </>
        )}
        {status === "slow" && (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="font-display text-xl uppercase tracking-wide">Quase lá</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O banco ainda está confirmando o pagamento. Assim que confirmar, os itens entram
              automaticamente na sua conta.
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                tries.current = 0;
                setStatus("loading");
                void check();
              }}
            >
              Verificar de novo
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
            <h1 className="font-display text-xl uppercase tracking-wide">Pagamento não concluído</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Não recebemos a confirmação da transação. Se o valor foi cobrado, ele aparece em
              minhas compras assim que o banco confirmar.
            </p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild>
            <Link to="/loja">Voltar à loja</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/compras">Ver minhas compras</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
