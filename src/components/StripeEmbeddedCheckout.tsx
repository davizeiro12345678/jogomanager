import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface StripeEmbeddedCheckoutProps {
  productKey: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ productKey, returnUrl }: StripeEmbeddedCheckoutProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "embedding" | "ready" | "error">("loading");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripe, setStripe] = useState<ReturnType<typeof getStripe> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkoutOptions = useMemo(
    () => (clientSecret ? { fetchClientSecret: async () => clientSecret } : null),
    [clientSecret],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setClientSecret(null);
    setStripe(null);
    setError(null);

    async function prepareCheckout() {
      try {
        const result = await createCheckoutSession({
          data: {
            productKey,
            returnUrl: returnUrl ?? `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          },
        });
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("A Stripe não retornou a chave desta sessão.");

        const stripePromise = getStripe();
        if (cancelled) return;
        setClientSecret(result.clientSecret);
        setStripe(stripePromise);
        setStatus("embedding");
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error && cause.message.trim()
            ? cause.message
            : "Não foi possível iniciar o pagamento seguro.",
        );
        setStatus("error");
      }
    }

    void prepareCheckout();
    return () => {
      cancelled = true;
    };
  }, [attempt, productKey, returnUrl]);

  useEffect(() => {
    if (status !== "embedding") return;
    const timeout = window.setTimeout(() => {
      setClientSecret(null);
      setStripe(null);
      setError("O pagamento seguro demorou para carregar. Tente novamente.");
      setStatus("error");
    }, 30_000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  function handleEmbedLoad(event: SyntheticEvent<HTMLDivElement>) {
    if (status === "embedding" && event.target instanceof HTMLIFrameElement) {
      setStatus("ready");
    }
  }

  function retry() {
    setAttempt((current) => current + 1);
  }

  const isLoading = status === "loading" || status === "embedding";

  return (
    <div
      id="checkout"
      onLoadCapture={handleEmbedLoad}
      aria-busy={isLoading}
      className="relative min-h-80 w-full overflow-hidden rounded-xl border border-border/60 bg-card"
    >
      {clientSecret && stripe && checkoutOptions ? (
        <EmbeddedCheckoutProvider key={attempt} stripe={stripe} options={checkoutOptions}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      ) : null}

      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 flex min-h-80 flex-col items-center justify-center gap-3 bg-card p-6 text-center text-sm text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>{status === "loading" ? "Preparando o pagamento seguro…" : "Carregando o checkout da Stripe…"}</span>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 z-10 flex min-h-80 flex-col items-center justify-center gap-4 bg-card p-6 text-center">
          <p role="alert" aria-live="assertive" className="max-w-xl text-sm text-destructive">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
