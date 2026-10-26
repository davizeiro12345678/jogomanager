import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { achievementById } from "@/game/achievements";
import { evaluateServerAchievements } from "./achievement-verification";

/**
 * Sincroniza conquistas do usuário logado.
 *
 * O save sincronizado é pessoal e não atesta resultados. Apenas a carreira
 * inicial reconstruída pelo servidor pode gerar conquistas neste fluxo.
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
    if (careerError) throw new Error("Não foi possível verificar as conquistas.");
    const earned = evaluateServerAchievements(career?.state, career?.verified_progress);
    if (!earned.length) return { ok: true, unlocked: [] as string[] };

    const rows = earned.map((key) => ({ user_id: context.userId, achievement_key: key }));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_achievements")
      .upsert(rows as never, { onConflict: "user_id,achievement_key", ignoreDuplicates: true });
    if (error) throw new Error("Não foi possível salvar as conquistas.");
    return { ok: true, unlocked: earned };
  });

export const loadAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_achievements")
      .select("achievement_key, unlocked_at")
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível carregar as conquistas.");
    return (data ?? []).filter((row) => achievementById(row.achievement_key));
  });
