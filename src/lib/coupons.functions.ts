import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RedeemCouponResult =
  | { ok: true; description: string; coins: number; scoutReports: number; trainingBoosts: number }
  | { ok: false; message: string };

const REASONS: Record<string, string> = {
  invalid: "Cupom não encontrado.",
  expired: "Este cupom não está valendo agora.",
  sold_out: "Este cupom já atingiu o limite de usos.",
  used: "Você já usou este cupom.",
  login: "Entre na sua conta para usar cupons.",
};

/** Resgate atômico no banco: uma vez por conta, recompensa creditada na carteira. */
export const redeemCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(3)
          .max(24)
          .regex(/^[A-Za-z0-9 ]+$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<RedeemCouponResult> => {
    const { data: res, error } = await context.supabase.rpc("redeem_game_coupon", {
      _code: data.code,
    });
    if (error) {
      console.error("redeemCoupon", error);
      return { ok: false, message: "Não foi possível resgatar agora. Tente de novo." };
    }
    const r = (res ?? {}) as Record<string, unknown>;
    if (r["ok"] !== true)
      return { ok: false, message: REASONS[String(r["reason"])] ?? REASONS["invalid"]! };
    return {
      ok: true,
      description: String(r["description"] ?? "Cupom resgatado"),
      coins: Number(r["coins"] ?? 0),
      scoutReports: Number(r["scoutReports"] ?? 0),
      trainingBoosts: Number(r["trainingBoosts"] ?? 0),
    };
  });
