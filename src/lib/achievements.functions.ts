import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sincroniza conquistas desbloqueadas localmente com a nuvem (usuário logado). */
export const syncAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { keys: string[] }) => input)
  .handler(async ({ data, context }) => {
    if (!data.keys.length) return { ok: true };
    const rows = data.keys.map((key) => ({ user_id: context.userId, achievement_key: key }));
    const { error } = await context.supabase
      .from("user_achievements")
      .upsert(rows as never, { onConflict: "user_id,achievement_key", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
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
