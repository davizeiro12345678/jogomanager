import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CareerState } from "@/game/types";
import { parseCareerCreateRequest, parseCareerOwner, parseCareerSaveRequest } from "./career-input";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { initCareer } from "@/game/career";
import { createCareerByUser, deleteCareerByUser } from "./career-lifecycle.server";

// A newly started career has no result to attest. Offline/imported results
// remain personal saves, not trusted achievements or official progress.
export function verifyCareerProgress(state: CareerState): boolean {
  if (state.season !== 1 || !CLUBS[state.clubId]) return false;
  const league = getLeague(state.leagueId);
  if (league.id !== state.leagueId || !league.clubs.some((club) => club.id === state.clubId))
    return false;
  const initial = initCareer(state.leagueId, state.clubId, state.managerName);
  if (state.fixtures.length !== initial.fixtures.length) return false;
  const byFixture = new Map(initial.fixtures.map((f) => [`${f.round}:${f.home}:${f.away}`, f]));
  if (
    state.round !== 1 ||
    state.results.length !== 0 ||
    !state.finances ||
    !Array.isArray(state.trophies) ||
    !Array.isArray(state.history) ||
    (state.matchLog !== undefined && !Array.isArray(state.matchLog))
  )
    return false;
  for (const fixture of state.fixtures) {
    const key = `${fixture.round}:${fixture.home}:${fixture.away}`;
    if (!byFixture.delete(key)) return false;
    if (fixture.homeGoals !== null || fixture.awayGoals !== null) return false;
  }
  return (
    byFixture.size === 0 &&
    state.finances.budget === initial.finances.budget &&
    state.finances.income === initial.finances.income &&
    state.finances.spent === initial.finances.spent &&
    state.trophies.length === 0 &&
    state.history.length === 0 &&
    (state.matchLog?.length ?? 0) === 0
  );
}

export const loadCareer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("careers")
      .select("state, updated_at, verified_progress, generation, deleted_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a carreira.");
    if (!data) return null;
    return {
      state: data.deleted_at ? null : (data.state as unknown as CareerState),
      updatedAt: (data.updated_at as string | null) ?? null,
      verifiedProgress: data.verified_progress,
      generation: data.generation,
      deletedAt: data.deleted_at,
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
    // Match scores and logs are produced on the client and cannot be replayed
    // here, so only a canonical, unplayed start is ever attested.
    let verified: boolean;
    try {
      verified = verifyCareerProgress(incoming);
    } catch {
      verified = false;
    }
    return saveValidatedCareer(context.userId, incoming, verified, data.expectedGeneration ?? null);
  });

export const createCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseCareerCreateRequest)
  .handler(async ({ data, context }) => {
    if (data.expectedOwnerId !== context.userId)
      throw new Error("A conta mudou. Reabra a criação antes de começar.");
    const incoming = data.state as unknown as CareerState;
    let verified: boolean;
    try {
      verified = verifyCareerProgress(incoming);
    } catch {
      verified = false;
    }
    return createCareerByUser(context.userId, incoming, verified, data.expectedGeneration ?? null);
  });

export const deleteCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseCareerOwner)
  .handler(async ({ data, context }) => {
    if (data.expectedOwnerId !== context.userId)
      throw new Error("A conta mudou. Reabra a carreira antes de excluir.");
    const tombstone = await deleteCareerByUser(context.userId);
    return { ok: true as const, ...tombstone };
  });
