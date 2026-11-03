import type { CareerState } from "@/game/types";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isStaleSave } from "./career-progress";
import { plausibilityIssues, type PlausibilityIssue } from "./career-plausibility";

const RISK_POINTS: Record<PlausibilityIssue, number> = {
  goals: 30,
  budget: 40,
  trophies: 40,
  match_pace: 20,
  season_pace: 25,
};
/** Above this 30-day score a save is never attested, even if it otherwise would be. */
export const RISK_HOLD_SCORE = 60;

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

    // Plausibility limits: implausible saves stay personal, never attested.
    let issues: PlausibilityIssue[];
    try {
      const elapsed = stored?.updated_at ? Date.now() - Date.parse(stored.updated_at) : null;
      issues = plausibilityIssues(previous ?? null, incoming, elapsed);
    } catch {
      issues = [];
    }
    if (issues.length > 0) {
      const { error: riskError } = await supabaseAdmin
        .from("career_risk_signals")
        .insert(issues.map((reason) => ({ user_id: userId, reason, points: RISK_POINTS[reason] })));
      if (riskError) console.error("career_risk_signals insert failed", riskError.message);
    }
    let attested = verifiedProgress && issues.length === 0;
    if (attested) {
      const { data: score } = await supabaseAdmin.rpc("career_risk_score", { _user_id: userId });
      if (typeof score === "number" && score >= RISK_HOLD_SCORE) attested = false;
    }
    const values = {
      state: incoming as unknown as Json,
      verified_progress: attested,
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
    if (written?.length) return { ok: true as const, stale: false, verifiedProgress: attested };
  }
  throw new Error("A carreira mudou em outra sessão. Tente sincronizar novamente.");
}
