import {
  createStripeClient,
  getConfiguredStripeEnvironment,
  type StripeEnv,
} from "./stripe.server";
import { getStoreServiceSupabase } from "./store-products.server";

export const PAYMENTS_UNAVAILABLE =
  "Os pagamentos estão temporariamente indisponíveis. Tente novamente mais tarde.";
export const GUEST_PAYMENTS_UNAVAILABLE =
  "A compra por e-mail está temporariamente indisponível. Entre na sua conta para ver as opções disponíveis.";

/** No network or financial mutations: verifies the deployment can accept and deliver payments. */
export function assertPaymentsConfigured(): StripeEnv {
  const environment = getConfiguredStripeEnvironment();
  createStripeClient(environment);
  if (!process.env["SUPABASE_URL"]?.trim() || !process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim()) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  getStoreServiceSupabase();
  const webhook =
    environment === "live" ? "PAYMENTS_LIVE_WEBHOOK_SECRET" : "PAYMENTS_SANDBOX_WEBHOOK_SECRET";
  if (!process.env[webhook]?.trim()) throw new Error(`${webhook} is not configured`);
  return environment;
}

export function assertGuestCheckoutEnabled(): StripeEnv {
  const environment = assertPaymentsConfigured();
  const requested = process.env["GUEST_CHECKOUT_ENVIRONMENT"]?.trim().toLowerCase();
  // The preview always runs sandbox; the deploy-wide pin only governs published builds.
  if (requested && requested !== environment && !import.meta.env.DEV) {
    throw new Error(
      "GUEST_CHECKOUT_ENVIRONMENT deve corresponder a PAYMENTS_ENVIRONMENT neste deploy.",
    );
  }
  const enabledFlag =
    environment === "sandbox" ? "GUEST_CHECKOUT_SANDBOX_ENABLED" : "GUEST_CHECKOUT_LIVE_ENABLED";
  if (process.env[enabledFlag] !== "true") {
    throw new Error("O checkout visitante ainda não está ativado neste ambiente.");
  }
  if (!process.env["GUEST_CHECKOUT_EMAIL_HASH_SECRET"]?.trim()) {
    throw new Error("O checkout visitante precisa de uma chave de segurança do servidor.");
  }
  return environment;
}

export function readCheckoutAvailability() {
  let environment: StripeEnv | null = null;
  try {
    environment = assertPaymentsConfigured();
  } catch {
    return {
      environment,
      account: { enabled: false, message: PAYMENTS_UNAVAILABLE },
      guest: { enabled: false, message: PAYMENTS_UNAVAILABLE },
    };
  }
  // Buying requires a signed-in account, so the email-only flow is never offered.
  return {
    environment,
    account: { enabled: true, message: null },
    guest: { enabled: false, message: GUEST_PAYMENTS_UNAVAILABLE },
  };
}
