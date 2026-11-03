import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CAREER_SERVICES, type CareerService } from "@/lib/wallet-rules";

export type CareerServiceResult =
  | { ok: true; coins: number; usedThisWeek: number }
  | { ok: false; reason: "not_enough_coins" | "weekly_limit" | "error"; coins?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Charges coins for a career service. Prices, limits and retries are decided by the database. */
export const spendCoinsOnService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { service: CareerService; requestId: string }) => {
    if (!input || !(input.service in CAREER_SERVICES)) throw new Error("Serviço inválido.");
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
        reason: row.reason === "weekly_limit" ? "weekly_limit" : "not_enough_coins",
        coins: row.coins,
      };
    return { ok: true, coins: row.coins, usedThisWeek: row.used_this_week };
  });
