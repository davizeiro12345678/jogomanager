import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";

export type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"]?.trim();

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Pagamentos não configurados para esta versão. Complete a ativação de pagamentos no projeto para aceitar pagamentos reais.",
  );
}

let stripePromise: Promise<Stripe> | null = null;

export function getStripe(): Promise<Stripe> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string)
      .then((stripe) => {
        if (!stripe)
          throw new Error("Não foi possível carregar o pagamento seguro neste navegador.");
        return stripe;
      })
      .catch((error: unknown) => {
        // A network/script failure must not poison every subsequent retry.
        stripePromise = null;
        throw error;
      });
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}
