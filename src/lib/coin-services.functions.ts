import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CAREER_SERVICES, type CareerService } from "@/lib/wallet-rules";
import { notifyUsers } from "@/lib/push.server";

/** Push text shown to the buyer after the database confirms a club service. */
const SERVICE_NOTIFICATION: Record<CareerService, string> = {
  injury_recovery: "Tratamento de lesão aplicado ao seu elenco.",
  opponent_report: "Relatório do adversário disponível na sua carreira.",
  youth_boost: "Impulso de jovem aplicado ao seu elenco.",
  stadium_upgrade: "Ampliação do estádio concluída.",
  contract_renewal: "Renovação de contrato concluída.",
  training_upgrade: "Aprimoramento de treino aplicado à semana.",
  premium_scout: "Relatório premium do olheiro disponível.",
};

export type CareerServiceResult =
  | { ok: true; coins: number; usedThisWeek: number; paidWith: "coins" | "stored_item" }
  | { ok: false; reason: "not_enough_coins" | "weekly_limit" | "error"; coins?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Charges a career service: a stored item from a shop pack first, otherwise coins.
 * Prices, limits and retries are decided by the database. */
export const spendCoinsOnService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: CareerService; requestId: string }) => {
    if (!input || !Object.hasOwn(CAREER_SERVICES, input.service))
      throw new Error("Serviço inválido.");
    if (typeof input.requestId !== "string" || !UUID.test(input.requestId))
      throw new Error("Pedido inválido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<CareerServiceResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("spend_coins_on_service", {
      _user_id: context.userId,
      _service: data.service,
      _request_id: data.requestId,
    });
    if (error) {
      console.error("spend_coins_on_service falhou", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false, reason: "error" };
    if (!row.ok)
      return {
        ok: false,
        reason:
          row.reason === "weekly_limit"
            ? "weekly_limit"
            : row.reason === "not_enough_coins"
              ? "not_enough_coins"
              : "error",
        coins: row.coins,
      };
    // Aviso por push ao comprador, sem segurar a resposta da cobrança.
    notifyUsers(supabaseAdmin, [context.userId], {
      title: "Seu clube",
      body: SERVICE_NOTIFICATION[data.service],
      path: "/clube",
    });
    return {
      ok: true,
      coins: row.coins,
      usedThisWeek: row.used_this_week,
      paidWith: row.reason === "stored_item" ? "stored_item" : "coins",
    };
  });
