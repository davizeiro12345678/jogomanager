import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle, XCircle, Loader2, Coins } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { claimCheckoutSession } from "@/lib/checkout-claim.functions";
import { checkoutErrorMessage, withPaymentTimeout } from "@/lib/embedded-checkout";
import { getPurchases } from "@/lib/purchases.functions";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/checkout/return")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Resultado do pagamento · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Resultado do pagamento · Pro Football Manager 3D: Jogo de Futebol Manager Online",
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
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => {
    const id = typeof search["session_id"] === "string" ? search["session_id"] : undefined;
    return id && /^cs_[a-zA-Z0-9_]+$/.test(id) ? { session_id: id } : {};
  },
  component: CheckoutReturn,
});

const MAX_TRIES = 15;

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const userId = useAuthUserId();
  const fetchPurchases = useServerFn(getPurchases);
  const claimSession = useServerFn(claimCheckoutSession);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "delivered" | "slow" | "error">("loading");
  const [message, setMessage] = useState("");
  const [coins, setCoins] = useState<number | null>(null);
  const [subscriptionDelivered, setSubscriptionDelivered] = useState(false);

  useEffect(() => {
    if (userId === undefined || userId === null) return;
    if (!sessionId) {
      setStatus("error");
      setMessage("Não encontramos uma sessão de pagamento válida neste endereço.");
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    setStatus("loading");
    setMessage("");
    setCoins(null);
    setSubscriptionDelivered(false);

    async function check() {
      try {
        // Subscription fulfillment has no one-time purchase row; consult its attested state again while pending.
        const result = await withPaymentTimeout(claimSession({ data: { sessionId: sessionId! } }));
        if (!alive) return;
        if (result.status === "error") {
          setMessage(result.message);
          setStatus("error");
          return;
        }
        if (result.status === "delivered" && result.kind === "subscription") {
          setSubscriptionDelivered(true);
          setStatus("delivered");
          return;
        }
        const data = await withPaymentTimeout(fetchPurchases());
        if (!alive) return;
        setCoins(data.coins);
        const purchase = data.purchases.find((item) => item.reference === sessionId);
        if (purchase?.status === "completed") {
          setStatus("delivered");
          track("compra_concluida", { produto: purchase.productKey });
          return;
        }
        if (purchase?.status === "failed") {
          setMessage(purchase.error || "Não foi possível concluir esta compra.");
          setStatus("error");
          return;
        }
        tries += 1;
        if (tries >= MAX_TRIES) {
          setStatus("slow");
          return;
        }
        // Wait for the preceding request; never overlap confirmation polls.
        timer = setTimeout(() => void check(), 2000);
      } catch (cause) {
        if (!alive) return;
        setMessage(checkoutErrorMessage(cause));
        setStatus("error");
      }
    }
    void check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [attempt, userId, sessionId, fetchPurchases, claimSession]);

  const next = sessionId
    ? `/checkout/return?session_id=${encodeURIComponent(sessionId)}`
    : "/compras";
  return (
    <div className="pitch-bg flex min-h-screen items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/90 p-6 text-center">
        {userId === null ? (
          <>
            <h1 className="font-display text-xl uppercase tracking-wide">
              Entre para acompanhar sua compra
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use a conta que abriu o pagamento para consultar a confirmação e a entrega dos itens.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link to="/auth" search={{ next }}>
                Entrar na minha conta
              </Link>
            </Button>
          </>
        ) : userId === undefined || status === "loading" ? (
          <>
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <h1 className="font-display text-xl uppercase tracking-wide">Confirmando…</h1>
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              Verificando a confirmação do pagamento e a entrega na sua conta.
            </p>
          </>
        ) : status === "delivered" ? (
          <>
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-green-500" />
            <h1 className="font-display text-xl uppercase tracking-wide">Tudo certo!</h1>
            {subscriptionDelivered ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Passe de temporada ativo na sua conta.
              </p>
            ) : (
              <p className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Coins size={16} className="text-primary" />
                Saldo agora: <strong className="text-foreground">{coins ?? 0}</strong> moedas
              </p>
            )}
          </>
        ) : (
          <>
            {status === "error" ? (
              <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
            ) : (
              <Loader2 className="mx-auto mb-4 h-10 w-10 text-primary" />
            )}
            <h1 className="font-display text-xl uppercase tracking-wide">
              {status === "error" ? "Não foi possível confirmar agora" : "Confirmação pendente"}
            </h1>
            <p
              role={status === "error" ? "alert" : "status"}
              className="mt-2 text-sm text-muted-foreground"
            >
              {status === "error"
                ? message
                : "A confirmação do pagamento ou a entrega ainda está pendente. Você pode acompanhar em Minhas compras ou verificar novamente."}
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Verificar de novo
            </Button>
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
