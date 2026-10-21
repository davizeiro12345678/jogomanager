import type { CareerState } from "@/game/types";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isStaleSave } from "./career-progress";

/** Shared by the authenticated game and MCP import handlers after validation. */
export async function saveValidatedCareer(
  userId: string,
  incoming: CareerState,
  verifiedProgress: boolean,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: stored, error: readError } = await supabaseAdmin
      .from("careers")
      .select("state, updated_at, verified_progress")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error("Não foi possível conferir a carreira salva.");
    const previous = stored?.state as unknown as CareerState | undefined;
    try {
      if (previous && isStaleSave(previous, incoming))
        return { ok: false as const, stale: true, verifiedProgress: stored!.verified_progress };
    } catch {
      // A malformed personal save can still be replaced by validated input.
    }

    const values = {
      state: incoming as unknown as Json,
      verified_progress: verifiedProgress,
    };
    // updated_at is NOT NULL and a BEFORE UPDATE trigger changes it. Preserve
    // its exact database precision: a later tab must make this predicate fail.
    const write = stored
      ? supabaseAdmin
          .from("careers")
          .update(values)
          .eq("user_id", userId)
          .eq("updated_at", stored.updated_at)
          .select("user_id")
      : supabaseAdmin
          .from("careers")
          .insert({ ...values, user_id: userId })
          .select("user_id");
    const { data: written, error: writeError } = await write;
    // Another tab may have created the first row after our empty read. Re-read
    // and re-check progress instead of allowing an upsert to overwrite it.
    if (!stored && writeError?.code === "23505") continue;
    if (writeError) throw new Error("Não foi possível salvar a carreira.");
    if (written?.length) return { ok: true as const, stale: false, verifiedProgress };
  }
  throw new Error("A carreira mudou em outra sessão. Tente sincronizar novamente.");
}
