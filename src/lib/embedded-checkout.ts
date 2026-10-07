import type { Stripe, StripeEmbeddedCheckout } from "@stripe/stripe-js";

export type CheckoutPhase = "loading" | "embedding" | "ready";

export function withPaymentTimeout<T>(request: Promise<T>, timeoutMs = 30_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("O serviço de pagamentos demorou para responder. Tente novamente.")),
      timeoutMs,
    );
    request.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause: unknown) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

export function checkoutErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim()) {
    if (/unauthorized|invalid token|authorization header/i.test(cause.message)) {
      return "Sua sessão expirou. Entre novamente na sua conta para abrir o pagamento.";
    }
    if (/is not configured|chave privada|chave pública|PAYMENTS_ENVIRONMENT/i.test(cause.message)) {
      return "Os pagamentos estão temporariamente indisponíveis. Tente novamente mais tarde.";
    }
    return cause.message;
  }
  return "Não foi possível abrir o pagamento seguro. Tente novamente.";
}

/** Owns the asynchronous SDK/session/mount lifecycle, including late results. */
export function startEmbeddedCheckout({
  element,
  loadStripe,
  fetchClientSecret,
  onPhase,
  onError,
  timeoutMs = 30_000,
}: {
  element: HTMLElement;
  loadStripe: () => Promise<Pick<Stripe, "createEmbeddedCheckoutPage">>;
  fetchClientSecret: () => Promise<string>;
  onPhase: (phase: CheckoutPhase) => void;
  onError: (message: string) => void;
  timeoutMs?: number;
}): () => void {
  let active = true;
  let checkout: StripeEmbeddedCheckout | null = null;
  let mounted = false;
  let rendered = false;
  let readyNotified = false;

  const destroy = () => {
    const current = checkout;
    checkout = null;
    current?.destroy();
  };
  const fail = (cause: unknown) => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    destroy();
    onError(checkoutErrorMessage(cause));
  };
  const ready = () => {
    if (!active || readyNotified || !mounted) return;
    readyNotified = true;
    clearTimeout(timer);
    onPhase("ready");
  };
  const timer = setTimeout(
    () => fail(new Error("O pagamento seguro demorou para carregar. Tente novamente.")),
    timeoutMs,
  );

  onPhase("loading");
  void (async () => {
    try {
      const stripe = await loadStripe();
      if (!active) return;
      const clientSecret = await fetchClientSecret();
      if (!active) return;
      if (!clientSecret?.trim()) throw new Error("A Stripe não retornou uma sessão de pagamento.");
      onPhase("embedding");
      const instance = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: async () => clientSecret,
        onAnalyticsEvent: (event) => {
          if (event.eventType === "checkoutRendered") {
            rendered = true;
            ready();
          }
        },
      });
      if (!active) {
        instance.destroy();
        return;
      }
      checkout = instance;
      checkout.mount(element);
      mounted = true;
      // The analytics callback is optional and can be blocked by privacy tools;
      // never keep the spinner covering a checkout that already mounted.
      setTimeout(() => {
        rendered = true;
        ready();
      }, 2500);
      ready();
    } catch (cause) {
      fail(cause);
    }
  })();

  return () => {
    active = false;
    clearTimeout(timer);
    destroy();
  };
}
