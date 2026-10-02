import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getConfiguredStripeEnvironment } from "@/lib/stripe.server";
import { isSeasonPassDelivered } from "@/lib/subscription-delivery.server";

export type ClaimResult =
  | { status: "delivered"; kind?: "subscription" }
  | { status: "pending" }
  | { status: "error"; message: string };

/**
 * Entrega a compra a partir da página de retorno.
 *
 * O webhook da Stripe continua sendo o caminho principal, mas ele pode demorar
 * ou não alcançar ambientes de prévia. Aqui o próprio usuário logado confirma a
 * sessão que acabou de pagar: verificamos na Stripe que a sessão é dele e está
 * paga e consultamos a entrega registrada pelo webhook assinado. A página de
 * retorno não concede itens; a entrega é idempotente pela referência da sessão.
 */
export const claimCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => {
    if (!/^cs_[a-zA-Z0-9_]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    try {
      const environment = getConfiguredStripeEnvironment();
      const stripe = createStripeClient(environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price"],
      });

      if (session.metadata?.["userId"] !== context.userId) {
        return { status: "error", message: "Esta compra não é desta conta." };
      }
      if (!["paid", "no_payment_required"].includes(session.payment_status)) {
        return { status: "pending" };
      }
      if (session.mode === "subscription") {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) return { status: "pending" };
        const [
          { data: subscription, error: subscriptionError },
          { data: wallet, error: walletError },
        ] = await Promise.all([
          context.supabase
            .from("subscriptions")
            .select("user_id, stripe_subscription_id, environment, status, current_period_end")
            .eq("user_id", context.userId)
            .eq("stripe_subscription_id", subscriptionId)
            .eq("environment", environment)
            .maybeSingle(),
          context.supabase
            .from("user_wallet")
            .select("season_pass, season_pass_until")
            .eq("user_id", context.userId)
            .maybeSingle(),
        ]);
        if (subscriptionError || walletError)
          throw new Error("Não foi possível consultar a entrega da assinatura.");
        return isSeasonPassDelivered({
          subscription,
          wallet,
          userId: context.userId,
          subscriptionId,
          environment,
        })
          ? { status: "delivered", kind: "subscription" }
          : { status: "pending" };
      }
      if (session.mode !== "payment") return { status: "pending" };

      // Delivery happens only in the signed Stripe webhook. This page just
      // reports whether that verified fulfillment has completed.
      const { data: purchase, error: purchaseError } = await context.supabase
        .from("user_purchases")
        .select("status")
        .eq("user_id", context.userId)
        .eq("reference", session.id)
        .maybeSingle();
      if (purchaseError) throw new Error("Não foi possível consultar a entrega da compra.");
      return purchase?.status === "completed" ? { status: "delivered" } : { status: "pending" };
    } catch (err) {
      console.error("claimCheckoutSession falhou", err);
      return {
        status: "error",
        message: "Não foi possível confirmar a compra agora.",
      };
    }
  });
