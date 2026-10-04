import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CareerState } from "@/game/types";
import { z } from "zod";
import { CLUBS, getLeague } from "@/game/data/leagues";
import { initCareer } from "@/game/career";

const CareerInput = z.object({
  state: z
    .object({
      leagueId: z.string().min(1).max(80),
      clubId: z.string().min(1).max(80),
      managerName: z.string().min(1).max(80),
      season: z.number().int().min(1).max(100),
      round: z.number().int().min(1).max(1000),
      fixtures: z.array(z.unknown()).max(5000),
      results: z.array(z.unknown()).max(5000),
    })
    .passthrough(),
});

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
  .validator((input: unknown) => CareerInput.parse(input))
  .handler(async ({ data, context }) => {
    const incoming = data.state as unknown as CareerState;
    // Malformed nested JSON is an unverified personal save, never an attested result.
    let verified = false;
    try {
      verified = verifyCareerProgress(incoming);
    } catch {
      verified = false;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("careers").upsert(
      {
        user_id: context.userId,
        state: incoming as unknown as never,
        verified_progress: verified,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("Não foi possível salvar a carreira.");
    return { ok: true, verifiedProgress: verified };
  });

export const deleteCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("careers").delete().eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível excluir a carreira.");
    return { ok: true };
  });
