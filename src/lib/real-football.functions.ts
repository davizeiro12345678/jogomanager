import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LEAGUE_LABELS } from "@/lib/league-labels";

/** Public, read-only projections of imported API-Football data (no private fields). */

export const FEATURED_LEAGUES = [
  { id: 71, slug: "brasileirao-serie-a" },
  { id: 72, slug: "brasileirao-serie-b" },
  { id: 39, slug: "premier-league" },
  { id: 140, slug: "la-liga" },
  { id: 135, slug: "serie-a-italia" },
  { id: 78, slug: "bundesliga" },
  { id: 61, slug: "ligue-1" },
  { id: 94, slug: "liga-portugal" },
  { id: 88, slug: "eredivisie" },
  { id: 128, slug: "liga-argentina" },
  { id: 253, slug: "mls" },
  { id: 262, slug: "liga-mx" },
] as const;

export type StandingRow = {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

export type LeagueTable = {
  id: number;
  slug: string;
  name: string;
  country: string;
  season: number;
  logo: string;
  updatedAt: string;
  groups: StandingRow[][];
  injuries: { player: string; team: string; type: string; reason: string }[];
  scorers: TopPlayer[];
  assisters: TopPlayer[];
};

type RawStanding = {
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
    logo: string;
    standings: StandingRow[][];
  };
};
type RawInjury = {
  player?: { name?: string; type?: string; reason?: string };
  team?: { name?: string };
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function clean(rows: StandingRow[]): StandingRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    team: { id: r.team.id, name: r.team.name, logo: r.team.logo },
    points: r.points,
    goalsDiff: r.goalsDiff,
    form: r.form ?? null,
    description: r.description ?? null,
    all: r.all,
    home: r.home,
    away: r.away,
  }));
}

export const getLeagueTable = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(60) }).parse(d))
  .handler(async ({ data }): Promise<LeagueTable | null> => {
    const lg = FEATURED_LEAGUES.find((l) => l.slug === data.slug);
    if (!lg) return null;
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("league", lg.slug, async () => {
      const db = await admin();
      const { data: rows, error: standingsError } = await db
        .from("api_football_data")
        .select("ref, payload, updated_at")
        .eq("kind", "standings")
        .like("ref", `${lg.id}:%`)
        .order("ref", { ascending: false })
        .limit(1);
      if (standingsError) throw new Error("Não foi possível carregar a tabela da liga.");
      const row = rows?.[0];
      const raw = (row?.payload as unknown as RawStanding[] | null)?.[0];
      if (!row || !raw) return null;
      const [injuryResult, topResult] = await Promise.all([
        db
          .from("api_football_data")
          .select("payload")
          .eq("kind", "injury")
          .eq("payload->league->>id", String(lg.id))
          .order("updated_at", { ascending: false })
          .limit(30),
        db
          .from("api_football_data")
          .select("ref, payload")
          .eq("kind", "top_stats")
          .in("ref", [
            `scorers_${lg.id}_${raw.league.season}`,
            `assists_${lg.id}_${raw.league.season}`,
          ]),
      ]);
      if (injuryResult.error || topResult.error)
        throw new Error("Não foi possível carregar os dados completos da liga.");
      const inj = injuryResult.data;
      const tops = topResult.data;
      const seen = new Set<string>();
      const injuries = (inj ?? [])
        .map((i) => i.payload as unknown as RawInjury)
        .filter((p) => p.player?.name && p.team?.name)
        .filter((p) => (seen.has(p.player!.name!) ? false : (seen.add(p.player!.name!), true)))
        .slice(0, 16)
        .map((p) => ({
          player: p.player!.name!,
          team: p.team!.name!,
          type: p.player?.type ?? "",
          reason: p.player?.reason ?? "",
        }));
      const pick = (prefix: string) =>
        (
          ((tops ?? []).find((t) => t.ref.startsWith(prefix))?.payload as unknown as
            RawTop[] | null) ?? []
        )
          .slice(0, 10)
          .map(toTop)
          .filter((t): t is TopPlayer => t !== null);
      return {
        id: lg.id,
        slug: lg.slug,
        name: raw.league.name,
        country: raw.league.country,
        season: raw.league.season,
        logo: raw.league.logo,
        updatedAt: row.updated_at,
        groups: raw.league.standings.map(clean),
        injuries,
        scorers: pick("scorers_"),
        assisters: pick("assists_"),
      };
    });
  });

export type TopPlayer = {
  name: string;
  age: number | null;
  nationality: string | null;
  photo: string | null;
  team: string;
  apps: number;
  minutes: number;
  goals: number;
  assists: number;
  rating: number | null;
};
type RawTop = {
  player?: { name?: string; age?: number; nationality?: string; photo?: string };
  statistics?: {
    team?: { name?: string };
    games?: { appearences?: number; minutes?: number; rating?: string | null };
    goals?: { total?: number | null; assists?: number | null };
  }[];
};
function toTop(r: RawTop): TopPlayer | null {
  const s = r.statistics?.[0];
  if (!r.player?.name || !s) return null;
  return {
    name: r.player.name,
    age: r.player.age ?? null,
    nationality: r.player.nationality ?? null,
    photo: r.player.photo ?? null,
    team: s.team?.name ?? "",
    apps: s.games?.appearences ?? 0,
    minutes: s.games?.minutes ?? 0,
    goals: s.goals?.total ?? 0,
    assists: s.goals?.assists ?? 0,
    rating: s.games?.rating ? Number(Number(s.games.rating).toFixed(2)) : null,
  };
}

export type ClubReal = {
  coach: {
    name: string;
    age: number | null;
    nationality: string | null;
    photo: string | null;
  } | null;
  injuries: { player: string; type: string; reason: string }[];
  transfers: {
    player: string;
    date: string;
    type: string;
    direction: "in" | "out";
    other: string;
  }[];
};

type RawTransfer = {
  player?: { name?: string };
  transfers?: {
    date?: string;
    type?: string;
    teams?: {
      in?: { id?: number | null; name?: string };
      out?: { id?: number | null; name?: string };
    };
  }[];
};

export const getClubReal = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }): Promise<ClubReal> => {
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("club", data.name, async () => {
      const db = await admin();
      const [coachRes, injRes, teamRes] = await Promise.all([
        db
          .from("api_football_data")
          .select("payload")
          .eq("kind", "coach")
          .eq("payload->team->>name", data.name)
          .limit(1),
        db
          .from("api_football_data")
          .select("payload")
          .eq("kind", "injury")
          .eq("payload->team->>name", data.name)
          .order("updated_at", { ascending: false })
          .limit(20),
        db
          .from("official_teams")
          .select("source_id")
          .eq("name", data.name)
          .like("source_id", "af:%")
          .limit(1),
      ]);
      if (coachRes.error || injRes.error || teamRes.error)
        throw new Error("Não foi possível carregar os dados completos do clube.");
      const c = coachRes.data?.[0]?.payload as
        { name?: string; age?: number; nationality?: string; photo?: string } | undefined;
      const seen = new Set<string>();
      const injuries = (injRes.data ?? [])
        .map((i) => i.payload as unknown as RawInjury)
        .filter((p) => p.player?.name && !seen.has(p.player.name) && seen.add(p.player.name))
        .slice(0, 8)
        .map((p) => ({
          player: p.player!.name!,
          type: p.player?.type ?? "",
          reason: p.player?.reason ?? "",
        }));
      const teamId = Number(teamRes.data?.[0]?.source_id.slice(3));
      const transfers: ClubReal["transfers"] = [];
      if (teamId) {
        const { data: tr, error: transferError } = await db
          .from("api_football_data")
          .select("payload")
          .eq("kind", "transfer")
          .eq("ref", String(teamId))
          .limit(1);
        if (transferError) throw new Error("Não foi possível carregar as transferências do clube.");
        for (const entry of (tr?.[0]?.payload as unknown as RawTransfer[] | null) ?? []) {
          for (const t of entry.transfers ?? []) {
            if (!entry.player?.name || !t.date) continue;
            const isIn = t.teams?.in?.id === teamId;
            const other = isIn ? t.teams?.out?.name : t.teams?.in?.name;
            transfers.push({
              player: entry.player.name,
              date: t.date,
              type: t.type ?? "",
              direction: isIn ? "in" : "out",
              other: other ?? "",
            });
          }
        }
        transfers.sort((a, b) => b.date.localeCompare(a.date));
        transfers.splice(8);
      }
      return {
        transfers,
        coach: c?.name
          ? {
              name: c.name,
              age: c.age ?? null,
              nationality: c.nationality ?? null,
              photo: c.photo ?? null,
            }
          : null,
        injuries,
      };
    });
  });

export type LeagueDigest = {
  slug: string;
  name: string;
  country: string;
  season: number;
  teams: number;
  goalsPerGame: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  leader: string;
  leaderGap: number;
  bestDefense: { team: string; against: number; played: number };
  overPerformer: { team: string; rank: number; goalsDiff: number } | null;
  injuries: number;
};

/** Compact, real per-league numbers used by the public guides. */
export const getLeagueDigests = createServerFn({ method: "GET" }).handler(
  async (): Promise<LeagueDigest[]> => {
    const { cachedPublicRead } = await import("./public-read-cache.server");
    return cachedPublicRead("digest", "featured-v1", async () => {
      const db = await admin();
      // One bounded server-only RPC replaces 24 independent Data API calls.
      // Raw provider records never leave this handler; only this projection does.
      const leagueIds = FEATURED_LEAGUES.map((league) => league.id);
      const { data: rows, error } = await db.rpc("get_public_league_digest_source", {
        p_league_ids: leagueIds,
      });
      if (error) throw new Error("Não foi possível carregar os indicadores das ligas.");
      const source = new Map((rows ?? []).map((row) => [row.league_id, row]));
      // The RPC includes null payloads for absent leagues. Every requested ID
      // must still arrive once: a custom Data API cap must not cache a subset.
      if (
        rows?.length !== leagueIds.length ||
        source.size !== leagueIds.length ||
        leagueIds.some((id) => !source.has(id))
      )
        throw new Error("Não foi possível carregar todos os indicadores das ligas.");
      const out: LeagueDigest[] = [];
      for (const lg of FEATURED_LEAGUES) {
        const row = source.get(lg.id);
        const raw = (row?.payload as unknown as RawStanding[] | null)?.[0];
        const table = raw?.league.standings[0];
        if (!raw || !table || table.length < 6) continue;
        let hw = 0,
          d = 0,
          aw = 0,
          goals = 0;
        for (const r of table) {
          hw += r.home.win;
          aw += r.away.win;
          d += r.home.draw;
          goals += r.home.goals.for + r.home.goals.against;
        }
        const games = hw + aw + d;
        if (!games) continue;
        const defense = [...table].sort(
          (a, b) =>
            a.all.goals.against / Math.max(1, a.all.played) -
            b.all.goals.against / Math.max(1, b.all.played),
        )[0]!;
        const lowerHalf = table.slice(Math.ceil(table.length / 2));
        const over = [...lowerHalf].sort((a, b) => b.goalsDiff - a.goalsDiff)[0];
        out.push({
          slug: lg.slug,
          name: LEAGUE_LABELS[lg.slug]?.name ?? raw.league.name,
          country: LEAGUE_LABELS[lg.slug]?.country ?? raw.league.country,
          season: raw.league.season,
          teams: table.length,
          goalsPerGame: goals / games,
          homeWinPct: (hw / games) * 100,
          drawPct: (d / games) * 100,
          awayWinPct: (aw / games) * 100,
          leader: table[0]!.team.name,
          leaderGap: table[0]!.points - table[1]!.points,
          bestDefense: {
            team: defense.team.name,
            against: defense.all.goals.against,
            played: defense.all.played,
          },
          overPerformer: over
            ? { team: over.team.name, rank: over.rank, goalsDiff: over.goalsDiff }
            : null,
          injuries: row?.injury_count ?? 0,
        });
      }
      return out;
    });
  },
);
