import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getConfiguredStripeEnvironment } from "@/lib/stripe.server";

export type ClaimResult =
  { status: "delivered" } | { status: "pending" } | { status: "error"; message: string };

/**
 * Entrega a compra a partir da página de retorno.
 *
 * O webhook da Stripe continua sendo o caminho principal, mas ele pode demorar
 * ou não alcançar ambientes de prévia. Aqui o próprio usuário logado confirma a
 * sessão que acabou de pagar: verificamos na Stripe que a sessão é dele e está
 * paga antes de creditar. A entrega é idempotente pela referência da sessão.
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
      const stripe = createStripeClient(getConfiguredStripeEnvironment());
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price"],
      });

      if (session.metadata?.["userId"] !== context.userId) {
        return { status: "error", message: "Esta compra não é desta conta." };
      }
      if (session.mode !== "payment") {
        // Assinaturas seguem pelos eventos customer.subscription.*.
        return { status: "pending" };
      }
      if (session.payment_status !== "paid") {
        return { status: "pending" };
      }

      // Delivery happens only in the signed Stripe webhook. This page just
      // reports whether that verified fulfillment has completed.
      const { data: purchase } = await context.supabase
        .from("user_purchases")
        .select("status")
        .eq("user_id", context.userId)
        .eq("reference", session.id)
        .maybeSingle();
      return purchase?.status === "completed" ? { status: "delivered" } : { status: "pending" };
    } catch (err) {
      console.error("claimCheckoutSession falhou", err);
      return {
        status: "error",
        message: "Não foi possível confirmar a compra agora.",
      };
    }
  });
