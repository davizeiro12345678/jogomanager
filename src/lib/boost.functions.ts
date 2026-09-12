import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Impulso de treino: vale por uma semana, dá +25% de treino e +5 de
 * recuperação, e não acumula — ativar de novo só recomeça a semana.
 * Vale apenas na carreira individual.
 */

export const TRAINING_BOOST_RATE = 0.25;
export const TRAINING_BOOST_RECOVERY = 5;

export type BoostState = { activeUntil: string | null; boostsLeft: number };

export type ActivateBoostResult =
  | { ok: true; activeUntil: string | null; boostsLeft: number }
  | { ok: false; reason: "no_boost" | "error" };

export const getBoostState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BoostState> => {
    const [boost, wallet] = await Promise.all([
      context.supabase
        .from("user_boosts")
        .select("training_until")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("user_wallet")
        .select("training_boosts")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    return {
      activeUntil: boost.data?.training_until ?? null,
      boostsLeft: wallet.data?.training_boosts ?? 0,
    };
  });

export const activateTrainingBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivateBoostResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("activate_training_boost", {
      _user_id: context.userId,
    });
    if (error) {
      console.error("activate_training_boost falhou", error.message);
      return { ok: false, reason: "error" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, reason: "no_boost" };
    return { ok: true, activeUntil: row.training_until, boostsLeft: row.training_boosts };
  });

/** O impulso está valendo agora? */
export function boostActive(state: BoostState | undefined): boolean {
  if (!state?.activeUntil) return false;
  return new Date(state.activeUntil).getTime() > Date.now();
}
