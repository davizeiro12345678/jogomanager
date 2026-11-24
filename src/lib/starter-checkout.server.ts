import type { AppDb } from "./app-db";
import type Stripe from "stripe";
import type { StripeEnv } from "./stripe.server";

type StarterOwner = {
  session_id: string;
  user_id: string;
  environment: string;
  price_cents: number | null;
  currency: string | null;
};
type StarterSession = {
  id: string;
  livemode: boolean;
  mode: string | null;
  status: string | null;
  payment_status: string;
  metadata: Record<string, string> | null;
  amount_subtotal: number | null;
  currency: string | null;
  client_secret: string | null;
};

export function starterSessionAction(
  owner: StarterOwner,
  session: StarterSession,
): "reuse" | "release" {
  if (
    session.id !== owner.session_id ||
    session.livemode !== (owner.environment === "live") ||
    session.metadata?.["userId"] !== owner.user_id ||
    session.metadata?.["productKey"] !== "starter_bundle" ||
    session.mode !== "payment" ||
    owner.price_cents === null ||
    owner.currency === null ||
    session.amount_subtotal !== owner.price_cents ||
    session.currency?.toUpperCase() !== owner.currency.toUpperCase() ||
    session.payment_status !== "unpaid"
  )
    throw new Error("Não foi possível confirmar uma sessão anterior do Pacote de estreia.");
  if (session.status === "expired") return "release";
  if (session.status === "open" && session.client_secret) return "reuse";
  throw new Error("O Pacote de estreia só pode ser comprado uma vez por conta.");
}

export async function recoverStarterCheckout(
  db: AppDb,
  stripe: Stripe,
  userId: string,
  environment: StripeEnv,
) {
  const { count, error: purchaseError } = await db
    .from("user_purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("product_key", "starter_bundle")
    .in("status", ["completed", "pending"]);
  if (purchaseError || count === null)
    throw new Error("Não foi possível confirmar a elegibilidade da oferta.");
  if (count > 0) throw new Error("O Pacote de estreia só pode ser comprado uma vez por conta.");

  const { data: owner, error } = await db
    .from("checkout_session_owners")
    .select("session_id,user_id,environment,price_cents,currency")
    .eq("user_id", userId)
    .eq("environment", environment)
    .eq("product_key", "starter_bundle")
    .is("starter_slot_released_at", null)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar a sessão anterior.");
  if (!owner) return null;
  const session = await stripe.checkout.sessions.retrieve(owner.session_id);
  const action = starterSessionAction(owner, session);
  if (action === "reuse") {
    return {
      clientSecret: session.client_secret!,
      productKey: "starter_bundle",
      priceCents: owner.price_cents!,
      currency: owner.currency!,
    };
  }
  // The persisted slot is released only after Stripe confirms expiry. A retry
  // may race with another request, but only one new owner can win the index.
  const { error: releaseError } = await db
    .from("checkout_session_owners")
    .update({ starter_slot_released_at: new Date().toISOString() })
    .eq("session_id", owner.session_id)
    .eq("user_id", userId)
    .eq("environment", environment)
    .is("starter_slot_released_at", null);
  if (releaseError) throw new Error("Não foi possível renovar a sessão expirada.");
  return null;
}
