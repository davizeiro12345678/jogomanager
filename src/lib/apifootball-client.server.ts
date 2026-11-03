import { AsyncLocalStorage } from "node:async_hooks";
import { type Phase } from "./apifootball-phases";
import { type AfImportResult } from "./apifootball-import.server";

export const BASE = "https://v3.football.api-sports.io";

export const SOURCE = "api-football";

export type LeagueTarget = {
  source_id: string;
  current_season: string | null;
  coverage: unknown;
  local_competition_id: string | null;
};

export type TeamTarget = {
  source_id: string;
  local_club_id: string | null;
  league_source_id: string | null;
};

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const importScope = new AsyncLocalStorage<{
  deadline: number;
  remaining: number | null;
  seasons: Map<string, string | null>;
}>();

export const remainingQuota = () => importScope.getStore()?.remaining ?? null;

/** Every outbound API-Football request reserves a global database quota token. */
export async function guardedFootballFetch(path: string): Promise<Response> {
  const scope = importScope.getStore();
  if (!scope || Date.now() + 1000 >= scope.deadline)
    throw new Error("API-Football invocation deadline reached");
  const key = process.env["APIFOOTBALL_API_KEY"];
  if (!key) throw new Error("API-Football server credential is not configured");
  const db = await admin();
  const quota = await db.rpc("reserve_api_football_quota");
  if (quota.error || quota.data !== true) {
    throw new Error(`API-Football quota blocked: ${quota.error?.message ?? "no token"}`);
  }
  return fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": key },
    signal: AbortSignal.timeout(Math.max(1, Math.min(20_000, scope.deadline - Date.now() - 500))),
  });
}

/**
 * Read and validate one API-Football response. A missing record (404) is not
 * fatal to the surrounding batch; auth, schema and upstream errors are.
 */
export type ApiFootballPage<T> = {
  response: T[];
  paging?: { current?: number; total?: number };
};

export async function afPage<T>(path: string): Promise<ApiFootballPage<T>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await guardedFootballFetch(path);
    const rem = res.headers.get("x-ratelimit-requests-remaining");
    if (rem !== null && Number.isFinite(Number(rem)))
      importScope.getStore()!.remaining = Number(rem);
    const text = await res.text();
    const limited = res.status === 429 || /"rateLimit"/i.test(text);
    if ((limited || res.status >= 500) && attempt < 2) {
      const hint = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(hint) && hint > 0 ? Math.min(8_000, hint * 1_000) : 2_000 * (attempt + 1);
      if (Date.now() + delay + 1000 >= importScope.getStore()!.deadline)
        throw new Error("API-Football retry exceeds invocation budget");
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (res.status === 404 || res.status === 204) return { response: [] };
    if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
    let body: {
      response?: unknown;
      errors?: unknown;
      paging?: { current?: number; total?: number };
    };
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      throw new Error("API-Football returned invalid JSON");
    }
    if (body.errors && typeof body.errors === "object" && Object.keys(body.errors).length > 0) {
      throw new Error("API-Football provider rejected the request");
    }
    if (!Array.isArray(body.response)) {
      throw new Error("API-Football returned an unexpected response shape");
    }
    return { response: body.response as T[], ...(body.paging ? { paging: body.paging } : {}) };
  }
  throw new Error("API-Football retry limit exceeded");
}

export async function af<T>(path: string): Promise<T[]> {
  return (await afPage<T>(path)).response;
}

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function mapPos(p?: string) {
  if (!p) return "MF";
  if (p.startsWith("Goal")) return "GK";
  if (p.startsWith("Def")) return "DF";
  if (p.startsWith("Att")) return "FW";
  return "MF";
}

/**
 * Missing data is a skip, not a failed batch. True failures preserve the
 * checkpoint so the job can retry without silently losing an item.
 */
export async function pool<T>(
  items: T[],
  n: number,
  deadline: number,
  fn: (t: T) => Promise<boolean | void>,
): Promise<{ done: number; skipped: number }> {
  let i = 0;
  let done = 0;
  let skipped = 0;
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length && Date.now() < deadline) {
        const item = items[i++]!;
        try {
          if ((await fn(item)) === false) skipped++;
        } catch (e) {
          failures.push(e instanceof Error ? e.message : String(e));
        }
        done++;
      }
    }),
  );
  if (failures.length) {
    throw new Error(`API-Football batch: ${failures.length} failed items; first: ${failures[0]}`);
  }
  return { done, skipped };
}

export async function leaguePage(offset: number, limit: number) {
  const db = await admin();
  const { data, error } = await db.rpc("list_api_football_league_targets", {
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeagueTarget[];
}

export async function saveRaw(kind: string, rows: { ref: string; payload: unknown }[]) {
  if (!rows.length) return 0;
  rows = [...new Map(rows.map((r) => [r.ref, r])).values()];
  const db = await admin();
  let n = 0;
  for (let k = 0; k < rows.length; k += 100) {
    const chunk = rows.slice(k, k + 100).map((r) => ({
      kind,
      ref: r.ref,
      payload: r.payload as never,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from("api_football_data").upsert(chunk, { onConflict: "kind,ref" });
    if (error) throw new Error(error.message);
    n += chunk.length;
  }
  return n;
}

export function sourceHasNoCoverage(coverage: unknown, phase: Phase): boolean {
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) return false;
  const c = coverage as Record<string, unknown>;
  if (phase === "standings") return c["standings"] === false;
  if (phase === "injuries") return c["injuries"] === false;
  if (phase === "stats") return c["players"] === false;
  return false;
}

export async function perLeague(
  phase: Phase,
  offset: number,
  limit: number,
  deadline: number,
  fn: (id: string, season: string) => Promise<number>,
): Promise<AfImportResult> {
  const leagues = await leaguePage(offset, limit);
  let created = 0;
  // Paginated phases (stats) stay sequential to respect the per-minute cap.
  const batch = await pool(leagues, phase === "stats" ? 2 : 4, deadline, async (lg) => {
    if (!lg.current_season || sourceHasNoCoverage(lg.coverage, phase)) return false;
    const written = await fn(lg.source_id.slice(3), lg.current_season);
    created += written;
    if (written === 0) return false;
    return true;
  });
  return {
    ok: true,
    phase,
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset:
      leagues.length < limit && batch.done === leagues.length ? null : offset + batch.done,
    remainingQuota: remainingQuota(),
  };
}

export async function pagedAll<T>(path: string, maxPages: number) {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const body = await afPage<T>(`${path}${sep}page=${page}`);
    out.push(...body.response);
    const total = body.paging?.total ?? 1;
    if (page >= total) return out;
  }
  // Silent truncation makes a partially imported league look complete.
  throw new Error(`API-Football pagination exceeded ${maxPages} pages: ${path}`);
}

export async function teamPage(offset: number, limit: number) {
  const db = await admin();
  const { data, error } = await db.rpc("list_api_football_team_targets", {
    p_offset: offset,
    p_limit: limit,
    p_squads_only: false,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamTarget[];
}

export async function perTeam(
  phase: Phase,
  offset: number,
  limit: number,
  deadline: number,
  fn: (team: string, league: string | null) => Promise<number>,
): Promise<AfImportResult> {
  const teams = await teamPage(offset, limit);
  let created = 0;
  const batch = await pool(teams, 4, deadline, async (t) => {
    const written = await fn(
      t.source_id.slice(3),
      t.league_source_id?.startsWith("af:") ? t.league_source_id.slice(3) : null,
    );
    created += written;
    if (written === 0) return false;
    return true;
  });
  return {
    ok: true,
    phase,
    processed: batch.done,
    created,
    linked: 0,
    skipped: batch.skipped,
    nextOffset: teams.length < limit && batch.done === teams.length ? null : offset + batch.done,
    remainingQuota: remainingQuota(),
  };
}

export async function seasonOf(league: string) {
  const seasonCache = importScope.getStore()!.seasons;
  if (seasonCache.has(league)) return seasonCache.get(league)!;
  const db = await admin();
  const { data } = await db
    .from("official_leagues")
    .select("current_season")
    .eq("source_id", `af:${league}`)
    .maybeSingle();
  seasonCache.set(league, data?.current_season ?? null);
  return data?.current_season ?? null;
}
