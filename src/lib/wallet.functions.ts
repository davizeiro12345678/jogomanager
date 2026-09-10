import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SpendInput = z.object({
  amount: z.number().int().positive().max(1_000_000),
});

export type SpendCoinsResult =
  | { ok: true; coins: number; seasonPass: boolean }
  | { ok: false; reason: "insufficient" | "error" };

/**
 * Débito de moedas. O saldo é sempre alterado no servidor, para o usuário do
 * token verificado — o navegador não consegue escolher outra conta.
 */
export const spendCoinsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SpendInput.parse(input))
  .handler(async ({ data, context }): Promise<SpendCoinsResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("spend_coins_for", {
      _user_id: context.userId,
      amount: data.amount,
    });

    if (error) {
      console.error("spend_coins_for falhou", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false, reason: "insufficient" };
    return { ok: true, coins: row.coins, seasonPass: row.season_pass };
  });
