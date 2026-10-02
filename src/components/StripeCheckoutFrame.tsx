import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { startEmbeddedCheckout, type CheckoutPhase } from "@/lib/embedded-checkout";
import { getStripe } from "@/lib/stripe";

/** Shared by account and guest checkout so both surface SDK/session errors. */
export function StripeCheckoutFrame({
  fetchClientSecret,
}: {
  fetchClientSecret: () => Promise<string>;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<CheckoutPhase>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target.current) return;
    setError(null);
    return startEmbeddedCheckout({
      element: target.current,
      loadStripe: getStripe,
      fetchClientSecret,
      onPhase: setPhase,
      onError: setError,
    });
  }, [attempt, fetchClientSecret]);

  const loading = !error && phase !== "ready";
  return (
    <div
      aria-busy={loading}
      className="relative min-h-80 w-full rounded-xl border border-border/60 bg-card"
    >
      <div ref={target} className="min-h-80" />
      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-10 flex min-h-80 flex-col items-center justify-center gap-3 rounded-xl bg-card p-6 text-center text-sm text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>
            {phase === "loading"
              ? "Preparando o pagamento seguro…"
              : "Carregando o checkout da Stripe…"}
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-10 flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl bg-card p-6 text-center">
          <p role="alert" aria-live="assertive" className="max-w-xl text-sm text-destructive">
            {error}
          </p>
          <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
