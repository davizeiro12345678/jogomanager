import type { CareerState } from "@/game/types";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isStaleSave, progressScore } from "./career-progress";
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

export type CareerSaveResult =
  | { ok: true; stale: false; verifiedProgress: boolean; generation: number }
  | { ok: false; stale: true; verifiedProgress: boolean; generation: number }
  | {
      ok: false;
      stale: false;
      deleted: true;
      conflict: true;
      generation: number;
      deletedAt: string;
    }
  | {
      ok: false;
      stale: false;
      conflict: true;
      generation: number | null;
      reason:
        "generation_mismatch" | "missing_head" | "unknown_generation" | "same_score_divergence";
    };

/** Compare persisted JSON values independent of object-key insertion order. */
function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => structurallyEqual(value, b[index]))
    );
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = Object.keys(aRecord);
  return (
    keys.length === Object.keys(bRecord).length &&
    keys.every(
      (key) => Object.hasOwn(bRecord, key) && structurallyEqual(aRecord[key], bRecord[key]),
    )
  );
}

/** Shared by the authenticated game and MCP import handlers after validation. */
export async function saveValidatedCareer(
  userId: string,
  incoming: CareerState,
  verifiedProgress: boolean,
  expectedGeneration: number | null,
): Promise<CareerSaveResult> {
  let casMissed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: stored, error: readError } = await supabaseAdmin
      .from("careers")
      .select("state, updated_at, verified_progress, generation, deleted_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error("Não foi possível conferir a carreira salva.");
    if (!stored)
      return {
        ok: false,
        stale: false,
        conflict: true,
        generation: null,
        reason: "missing_head",
      };
    if (stored.deleted_at) {
      return {
        ok: false,
        stale: false,
        deleted: true,
        conflict: true,
        generation: stored.generation,
        deletedAt: stored.deleted_at,
      };
    }
    if (expectedGeneration === null)
      return {
        ok: false,
        stale: false,
        conflict: true,
        generation: stored.generation,
        reason: "unknown_generation",
      };
    if (expectedGeneration !== stored.generation)
      return {
        ok: false,
        stale: false,
        conflict: true,
        generation: stored.generation,
        reason: "generation_mismatch",
      };

    const previous = stored.state as unknown as CareerState;
    if (structurallyEqual(previous, incoming))
      return {
        ok: true,
        stale: false,
        verifiedProgress: stored.verified_progress,
        generation: stored.generation,
      };
    if (casMissed && progressScore(previous) === progressScore(incoming)) {
      return {
        ok: false,
        stale: false,
        conflict: true,
        generation: stored.generation,
        reason: "same_score_divergence",
      };
    }
    try {
      if (previous && isStaleSave(previous, incoming))
        return {
          ok: false,
          stale: true,
          verifiedProgress: stored.verified_progress,
          generation: stored.generation,
        };
    } catch {
      // A malformed personal save can still be replaced by validated input.
    }

    // Plausibility limits: implausible saves stay personal, never attested.
    let issues: PlausibilityIssue[];
    try {
      const elapsed = stored.updated_at ? Date.now() - Date.parse(stored.updated_at) : null;
      issues = plausibilityIssues(previous, incoming, elapsed);
    } catch {
      issues = [];
    }
    let attested = verifiedProgress && issues.length === 0;
    if (attested) {
      let score: number | null = null;
      let scoreUnavailable = false;
      try {
        const { data, error } = await supabaseAdmin.rpc("career_risk_score", {
          _user_id: userId,
        });
        const validScore = typeof data === "number" && Number.isFinite(data) && data >= 0;
        if (error || !validScore) scoreUnavailable = true;
        else score = data;
      } catch {
        scoreUnavailable = true;
      }
      if (scoreUnavailable) {
        console.error("career risk score unavailable; save stored without attestation");
        attested = false;
      } else if (typeof score === "number" && score >= RISK_HOLD_SCORE) {
        attested = false;
      }
    }
    const values = {
      state: incoming as unknown as Json,
      verified_progress: attested,
    };
    // updated_at is NOT NULL and a BEFORE UPDATE trigger changes it. Preserve
    // its exact database precision: a later tab must make this predicate fail.
    const { data: written, error: writeError } = await supabaseAdmin
      .from("careers")
      .update(values)
      .eq("user_id", userId)
      .eq("updated_at", stored.updated_at)
      .eq("generation", stored.generation)
      .is("deleted_at", null)
      .select("user_id");
    if (writeError) throw new Error("Não foi possível salvar a carreira.");
    if (written?.length) {
      if (issues.length > 0) {
        const { error: riskError } = await supabaseAdmin
          .from("career_risk_signals")
          .insert(
            issues.map((reason) => ({ user_id: userId, reason, points: RISK_POINTS[reason] })),
          );
        if (riskError) console.error("career_risk_signals insert failed", riskError.message);
      }
      return { ok: true, stale: false, verifiedProgress: attested, generation: stored.generation };
    }
    casMissed = true;
  }
  throw new Error("A carreira mudou em outra sessão. Tente sincronizar novamente.");
}
