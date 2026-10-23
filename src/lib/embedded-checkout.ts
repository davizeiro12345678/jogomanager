import type { Stripe, StripeEmbeddedCheckout } from "@stripe/stripe-js";

export type CheckoutPhase = "loading" | "creating-session" | "embedding" | "ready";

const PUBLIC_CHECKOUT_ERRORS = new Set([
  "Falha ao carregar Stripe.js",
  "A sessão de pagamento expirou",
  "A Stripe.js demorou para carregar. Verifique sua conexão e tente novamente.",
  "A criação da sessão de pagamento demorou. Tente novamente em instantes.",
  "A Stripe demorou para montar o checkout. Verifique sua conexão e tente novamente.",
  "A Stripe não retornou uma sessão de pagamento.",
  "O serviço de pagamentos demorou para responder. Tente novamente.",
]);

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
    // Provider/backend exceptions may include internal details or a client secret.
    if (PUBLIC_CHECKOUT_ERRORS.has(cause.message)) return cause.message;
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
  let observer: MutationObserver | null = null;
  let mounted = false;
  let rendered = false;
  let readyNotified = false;
  let observedFrame: HTMLIFrameElement | null = null;
  let removeFrameListener: (() => void) | null = null;

  const destroyInstance = (instance: StripeEmbeddedCheckout | null) => {
    try {
      instance?.destroy();
    } catch {
      // A third-party teardown failure must not strand loading or break unmount.
    }
  };

  const stopObserving = () => {
    observer?.disconnect();
    observer = null;
    removeFrameListener?.();
    removeFrameListener = null;
    observedFrame = null;
  };
  const destroy = () => {
    stopObserving();
    const current = checkout;
    checkout = null;
    destroyInstance(current);
  };
  const fail = (cause: unknown) => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    destroy();
    onError(checkoutErrorMessage(cause));
  };
  const ready = () => {
    if (!active || readyNotified || !mounted || !rendered) return;
    readyNotified = true;
    clearTimeout(timer);
    stopObserving();
    onPhase("ready");
  };
  const watchFrame = () => {
    const frame = element.querySelector("iframe");
    if (!frame || frame === observedFrame) return;
    removeFrameListener?.();
    observedFrame = frame;
    const loaded = () => {
      if (
        !active ||
        element.querySelector("iframe") !== frame ||
        frame.getBoundingClientRect().height < 120
      )
        return;
      // Fallback when analytics is absent: a loaded, visibly sized form.
      // Insertion alone leaves the render watchdog running.
      rendered = true;
      ready();
    };
    frame.addEventListener("load", loaded);
    removeFrameListener = () => frame.removeEventListener("load", loaded);
  };
  let currentStage: Exclude<CheckoutPhase, "ready"> = "loading";
  const timer = setTimeout(() => {
    const message =
      currentStage === "loading"
        ? "A Stripe.js demorou para carregar. Verifique sua conexão e tente novamente."
        : currentStage === "creating-session"
          ? "A criação da sessão de pagamento demorou. Tente novamente em instantes."
          : "A Stripe demorou para montar o checkout. Verifique sua conexão e tente novamente.";
    fail(new Error(message));
  }, timeoutMs);

  onPhase("loading");
  void (async () => {
    try {
      const stripe = await loadStripe();
      if (!active) return;
      currentStage = "creating-session";
      onPhase("creating-session");
      const clientSecret = await fetchClientSecret();
      if (!active) return;
      if (!clientSecret?.trim()) throw new Error("A Stripe não retornou uma sessão de pagamento.");
      currentStage = "embedding";
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
        destroyInstance(instance);
        return;
      }
      checkout = instance;
      if (typeof element.querySelector === "function" && typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(watchFrame);
        observer.observe(element, { childList: true, subtree: true });
      }
      checkout.mount(element);
      mounted = true;
      if (typeof element.querySelector === "function") watchFrame();
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
