import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveInput = z.object({
  slot: z.number().int().min(1).max(3),
  state: z
    .object({
      version: z.literal(1),
      name: z.string().min(1).max(40),
      clubId: z.string().min(1).max(80),
    })
    .passthrough(),
});

/** Saves de atleta são pessoais e nunca contam como progresso oficial. */
export const saveAthleteCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    if (JSON.stringify(data.state).length > 400_000) throw new Error("Save grande demais.");
    const { error } = await context.supabase.from("player_careers").upsert(
      {
        user_id: context.userId,
        slot: data.slot,
        state: data.state as never,
        verified_progress: false,
      },
      { onConflict: "user_id,slot" },
    );
    if (error) throw new Error("Não foi possível salvar o atleta na nuvem.");
    return { ok: true };
  });

export const loadAthletesCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("player_careers")
      .select("slot, state, updated_at")
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível carregar seus atletas.");
    return (data ?? []).map((r) => ({
      slot: r.slot as number,
      state: JSON.stringify(r.state),
      updatedAt: r.updated_at as string,
    }));
  });

export const deleteAthleteCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ slot: z.number().int().min(1).max(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("player_careers")
      .delete()
      .eq("user_id", context.userId)
      .eq("slot", data.slot);
    if (error) throw new Error("Não foi possível excluir o atleta.");
    return { ok: true };
  });
