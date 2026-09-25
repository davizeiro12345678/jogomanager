import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateAchievements } from "@/game/achievements";
import { initCareer } from "@/game/career";
import type { CareerState } from "@/game/types";
import { verifyCareerProgress } from "@/lib/career.functions";

/**
 * Sincroniza conquistas do usuário logado.
 *
 * O cliente não escolhe mais quais conquistas foram desbloqueadas: o servidor
 * lê a carreira salva na nuvem e recalcula as conquistas a partir desse estado.
 * Assim ninguém consegue se premiar com conquistas que não conquistou.
 */
export const syncAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: career, error: careerError } = await context.supabase
      .from("careers")
      .select("state, verified_progress")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (careerError) throw new Error(careerError.message);
    if (!career?.state || !career.verified_progress) return { ok: true, unlocked: [] as string[] };

    let earned: string[] = [];
    try {
      const saved = career.state as unknown as CareerState;
      if (!verifyCareerProgress(saved)) return { ok: true, unlocked: [] as string[] };
      // Even a valid initial save may contain arbitrary ancillary fields.
      // Award only from a canonical server-created career, never the payload.
      earned = evaluateAchievements(initCareer(saved.leagueId, saved.clubId, saved.managerName));
    } catch {
      return { ok: true, unlocked: [] as string[] };
    }
    if (!earned.length) return { ok: true, unlocked: [] as string[] };

    const rows = earned.map((key) => ({ user_id: context.userId, achievement_key: key }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_achievements")
      .upsert(rows as never, { onConflict: "user_id,achievement_key", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, unlocked: earned };
  });

export const loadAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
