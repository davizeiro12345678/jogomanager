// Bulk, resumable API-Football import. Each call processes one bounded page
// (offset/limit) so a runner can walk the whole catalog under the daily quota.
// Mappings live in official_leagues/official_teams with an "af:" prefix so they
// never collide with the other provider's ids.

import type { TablesInsert } from "@/integrations/supabase/types";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  FIXTURE_ENDPOINTS,
  LEADER_ENDPOINTS,
  apiFootballPlayerId,
  apiFootballProfileProjection,
  isApiFootballPhase,
  isFootballStaffRole,
  type Phase,
} from "./apifootball-phases";
import {
  importScope,
  remainingQuota,
  af,
  saveRaw,
  perLeague,
  perTeam,
} from "./apifootball-client.server";
import {
  importLeagues,
  importTeams,
  importSquads,
  importVenues,
  importPlayerProfiles,
} from "./apifootball-catalog.server";
import {
  fixturesFor,
  standingsFor,
  importStats,
  importPredictions,
  importOdds,
  importSimple,
  coachesFor,
  teamStatsFor,
  injuriesFor,
  importDetails,
  importPlayerRecords,
  importFixtureRecords,
} from "./apifootball-matches.server";
export type { Phase } from "./apifootball-phases";

export type AfImportResult = {
  ok: boolean;
  phase: Phase;
  processed: number;
  created: number;
  linked: number;
  skipped?: number;
  nextOffset: number | null;
  remainingQuota?: number | null;
  error?: string;
};

export async function runApiFootballImport(opts: {
  phase: Phase;
  offset: number;
  limit: number;
  budgetMs: number;
}): Promise<AfImportResult> {
  return importScope.run(
    { deadline: Date.now() + opts.budgetMs, remaining: null, seasons: new Map() },
    () => runImport(opts),
  );
}

async function runImport(opts: {
  phase: Phase;
  offset: number;
  limit: number;
  budgetMs: number;
}): Promise<AfImportResult> {
  const deadline = Date.now() + opts.budgetMs;
  // Match the service-side RPC page cap: otherwise a manual limit > 50
  // would wrongly treat a partial page as the end of the catalog.
  const limit = Math.max(1, Math.min(50, opts.limit));
  try {
    if (
      !isApiFootballPhase(opts.phase) ||
      !Number.isSafeInteger(opts.offset) ||
      opts.offset < 0 ||
      !Number.isSafeInteger(opts.limit) ||
      opts.limit < 1 ||
      !Number.isFinite(opts.budgetMs) ||
      opts.budgetMs < 1000 ||
      opts.budgetMs > 90000
    )
      throw new Error("Invalid API-Football import contract");
    if (opts.phase in LEADER_ENDPOINTS) {
      const phase = opts.phase as keyof typeof LEADER_ENDPOINTS;
      return await perLeague(phase, opts.offset, limit, deadline, async (id, season) => {
        const list = await af<unknown>(`${LEADER_ENDPOINTS[phase]}?league=${id}&season=${season}`);
        const rows = list.flatMap((row) => {
          const pid = apiFootballPlayerId(row);
          return pid ? [{ ref: `${pid}:${id}:${season}`, payload: row }] : [];
        });
        const written = await saveRaw(phase, rows);
        if (phase === "topscorers" || phase === "topassists")
          await saveRaw("top_stats", [
            {
              ref: `${phase === "topscorers" ? "scorers" : "assists"}_${id}_${season}`,
              payload: list,
            },
          ]);
        return written;
      });
    }
    if (opts.phase in FIXTURE_ENDPOINTS)
      return await importFixtureRecords(
        opts.phase as keyof typeof FIXTURE_ENDPOINTS,
        opts.offset,
        limit,
        deadline,
      );
    if (opts.phase === "playerprofiles") return await importPlayerProfiles(opts.offset);
    if (opts.phase === "transfers")
      return await perTeam("transfers", opts.offset, limit, deadline, async (team) => {
        const list = await af<unknown>(`/transfers?team=${team}`);
        return list.length ? saveRaw("transfer", [{ ref: team, payload: list }]) : 0;
      });
    if (opts.phase === "playerseasons" || opts.phase === "trophies" || opts.phase === "sidelined")
      return await importPlayerRecords(opts.phase, opts.offset, limit, deadline);
    if (opts.phase === "leagues") return await importLeagues();
    if (opts.phase === "teams") return await importTeams(opts.offset, limit, deadline);
    if (opts.phase === "fixtures")
      return await perLeague("fixtures", opts.offset, limit, deadline, fixturesFor);
    if (opts.phase === "standings")
      return await perLeague("standings", opts.offset, limit, deadline, standingsFor);
    if (opts.phase === "stats") return await importStats(opts.offset, deadline);
    if (opts.phase === "predictions") return await importPredictions(opts.offset, limit, deadline);
    if (opts.phase === "odds") return await importOdds(opts.offset, deadline);
    if (opts.phase === "countries")
      return await importSimple("countries", "/countries", "country", (r) =>
        String((r as { name?: unknown }).name ?? ""),
      );
    if (opts.phase === "timezones")
      return await importSimple("timezones", "/timezone", "timezone", (r) => String(r));
    if (opts.phase === "venues") return await importVenues(opts.offset, limit, deadline);
    if (opts.phase === "coaches")
      return await perTeam("coaches", opts.offset, limit, deadline, coachesFor);
    if (opts.phase === "teamstats")
      return await perTeam("teamstats", opts.offset, limit, deadline, teamStatsFor);
    if (opts.phase === "injuries")
      return await perLeague("injuries", opts.offset, limit, deadline, injuriesFor);
    if (opts.phase === "details") return await importDetails(opts.offset, limit, deadline);
    if (opts.phase === "squads") return await importSquads(opts.offset, limit, deadline);
    throw new Error("Unimplemented API-Football phase");
  } catch (e) {
    return {
      ok: false,
      phase: opts.phase,
      processed: 0,
      created: 0,
      linked: 0,
      nextOffset: opts.offset,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
