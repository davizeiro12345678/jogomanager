import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

export type ClaimResult =
  | { status: "delivered" }
  | { status: "pending" }
  | { status: "error"; message: string };

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
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_[a-zA-Z0-9_]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<ClaimResult> => {
    try {
      const stripe = createStripeClient(data.environment);
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

      const lineItem = session.line_items?.data?.[0];
      const price = lineItem?.price;
      const productKey =
        price?.lookup_key ||
        (price?.metadata?.["lovable_external_id"] as string | undefined) ||
        price?.id;
      if (!productKey) {
        return { status: "error", message: "Item da compra não identificado." };
      }

      const amount = lineItem?.amount_total ?? session.amount_total ?? 0;
      const { fulfillOneTimePurchase, recordPendingPurchase } = await import(
        "@/lib/fulfillment.server"
      );
      await recordPendingPurchase(context.userId, productKey, session.id, amount);
      await fulfillOneTimePurchase(context.userId, productKey, session.id, amount);
      return { status: "delivered" };
    } catch (err) {
      console.error("claimCheckoutSession falhou", err);
      return {
        status: "error",
        message: "Não foi possível confirmar a compra agora.",
      };
    }
  });
