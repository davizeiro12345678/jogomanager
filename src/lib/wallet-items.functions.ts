import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { COIN_EXCHANGE, type ExchangeItem } from "@/lib/wallet-rules";

export type UseScoutReportResult =
  | { ok: true; scoutReports: number; freeWithPass: boolean }
  | { ok: false; reason: "no_report" | "error" };

export type ExchangeResult =
  | { ok: true; coins: number; scoutReports: number; trainingBoosts: number }
  | { ok: false; reason: "not_enough_coins" | "error" };

export type PassCoinsResult =
  | { ok: true; claimed: boolean; coins: number; nextClaimAt: string | null }
  | { ok: false; reason: "error" };

/** Spends one stored scout report (free for active season pass holders). */
export const spendScoutReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UseScoutReportResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("use_scout_report", {
      _user_id: context.userId,
    });
    if (error) {
      console.error("use_scout_report falhou", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.used) return { ok: false, reason: "no_report" };
    return { ok: true, scoutReports: row.scout_reports, freeWithPass: row.free_with_pass };
  });

/** Trades coins for a scout report or a training boost at fixed server-side rates. */
export const exchangeCoinsForItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { item: ExchangeItem }) => {
    if (!(input?.item in COIN_EXCHANGE)) throw new Error("Item inválido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<ExchangeResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("exchange_coins_for_item", {
      _user_id: context.userId,
      _item: data.item,
    });
    if (error) {
      console.error("exchange_coins_for_item falhou", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.ok) return { ok: false, reason: "not_enough_coins" };
    return {
      ok: true,
      coins: row.coins,
      scoutReports: row.scout_reports,
      trainingBoosts: row.training_boosts,
    };
  });

/** Credits the season pass weekly coins once every 7 days. */
export const claimSeasonPassCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PassCoinsResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_season_pass_coins", {
      _user_id: context.userId,
    });
    if (error) {
      console.error("claim_season_pass_coins falhou", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      claimed: Boolean(row?.claimed),
      coins: row?.coins ?? 0,
      nextClaimAt: row?.next_claim_at ?? null,
    };
  });
