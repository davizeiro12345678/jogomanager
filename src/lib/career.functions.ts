import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CareerState } from "@/game/types";
import { parseCareerOwner, parseCareerSaveRequest } from "./career-input";

export { verifyCareerProgress } from "./career-verification";
import { verifyCareerProgress } from "./career-verification";

export const loadCareer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => (input === undefined ? undefined : parseCareerOwner(input)))
  .handler(async ({ data: input, context }) => {
    if (input && input.expectedOwnerId !== context.userId)
      throw new Error("A conta mudou. Reabra a carreira antes de continuar.");
    const { data, error } = await context.supabase
      .from("careers")
      .select("state, updated_at, verified_progress")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a carreira.");
    if (!data?.state) return null;
    return {
      state: data.state as unknown as CareerState,
      updatedAt: (data.updated_at as string | null) ?? null,
      verifiedProgress: data.verified_progress,
    };
  });

export const saveCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseCareerSaveRequest)
  .handler(async ({ data, context }) => {
    if (data.expectedOwnerId !== context.userId)
      throw new Error("A conta mudou. Reabra a carreira antes de salvar.");
    const incoming = data.state as unknown as CareerState;
    const { saveValidatedCareer } = await import("./career-save.server");
    // Malformed nested JSON is an unverified personal save, never an attested result.
    let verified: boolean;
    try {
      verified = verifyCareerProgress(incoming);
    } catch {
      verified = false;
    }
    return saveValidatedCareer(context.userId, incoming, verified);
  });

export const deleteCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseCareerOwner)
  .handler(async ({ data, context }) => {
    if (data.expectedOwnerId !== context.userId)
      throw new Error("A conta mudou. Reabra a carreira antes de excluir.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("careers").delete().eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível excluir a carreira.");
    return { ok: true };
  });
