import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  home: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  away: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
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
};

type RawStanding = {
  league: { id: number; name: string; country: string; season: number; logo: string; standings: StandingRow[][] };
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
    const db = await admin();
    const { data: rows } = await db
      .from("api_football_data")
      .select("ref, payload, updated_at")
      .eq("kind", "standings")
      .like("ref", `${lg.id}:%`)
      .order("ref", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    const raw = (row?.payload as unknown as RawStanding[] | null)?.[0];
    if (!row || !raw) return null;
    const { data: inj } = await db
      .from("api_football_data")
      .select("payload")
      .eq("kind", "injury")
      .eq("payload->league->>id", String(lg.id))
      .order("updated_at", { ascending: false })
      .limit(30);
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
    };
  });

export type ClubReal = {
  coach: { name: string; age: number | null; nationality: string | null; photo: string | null } | null;
  injuries: { player: string; type: string; reason: string }[];
};

export const getClubReal = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ name: z.string().min(2).max(80) }).parse(d))
  .handler(async ({ data }): Promise<ClubReal> => {
    const db = await admin();
    const [coachRes, injRes] = await Promise.all([
      db.from("api_football_data").select("payload").eq("kind", "coach")
        .eq("payload->team->>name", data.name).limit(1),
      db.from("api_football_data").select("payload").eq("kind", "injury")
        .eq("payload->team->>name", data.name).order("updated_at", { ascending: false }).limit(20),
    ]);
    const c = coachRes.data?.[0]?.payload as
      | { name?: string; age?: number; nationality?: string; photo?: string }
      | undefined;
    const seen = new Set<string>();
    const injuries = (injRes.data ?? [])
      .map((i) => i.payload as unknown as RawInjury)
      .filter((p) => p.player?.name && !seen.has(p.player.name) && seen.add(p.player.name))
      .slice(0, 8)
      .map((p) => ({ player: p.player!.name!, type: p.player?.type ?? "", reason: p.player?.reason ?? "" }));
    return {
      coach: c?.name
        ? { name: c.name, age: c.age ?? null, nationality: c.nationality ?? null, photo: c.photo ?? null }
        : null,
      injuries,
    };
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
    const db = await admin();
    const out: LeagueDigest[] = [];
    await Promise.all(
      FEATURED_LEAGUES.map(async (lg) => {
        const [{ data: rows }, { count }] = await Promise.all([
          db.from("api_football_data").select("payload").eq("kind", "standings")
            .like("ref", `${lg.id}:%`).order("ref", { ascending: false }).limit(1),
          db.from("api_football_data").select("ref", { count: "exact", head: true })
            .eq("kind", "injury").eq("payload->league->>id", String(lg.id)),
        ]);
        const raw = (rows?.[0]?.payload as unknown as RawStanding[] | null)?.[0];
        const table = raw?.league.standings[0];
        if (!raw || !table || table.length < 6) return;
        let hw = 0, d = 0, aw = 0, goals = 0;
        for (const r of table) {
          hw += r.home.win; aw += r.away.win; d += r.home.draw;
          goals += r.home.goals.for + r.home.goals.against;
        }
        const games = hw + aw + d;
        if (!games) return;
        const defense = [...table].sort((a, b) => a.all.goals.against / Math.max(1, a.all.played) - b.all.goals.against / Math.max(1, b.all.played))[0]!;
        const lowerHalf = table.slice(Math.ceil(table.length / 2));
        const over = [...lowerHalf].sort((a, b) => b.goalsDiff - a.goalsDiff)[0];
        out.push({
          slug: lg.slug,
          name: raw.league.name,
          country: raw.league.country,
          season: raw.league.season,
          teams: table.length,
          goalsPerGame: goals / games,
          homeWinPct: (hw / games) * 100,
          drawPct: (d / games) * 100,
          awayWinPct: (aw / games) * 100,
          leader: table[0]!.team.name,
          leaderGap: table[0]!.points - table[1]!.points,
          bestDefense: { team: defense.team.name, against: defense.all.goals.against, played: defense.all.played },
          overPerformer: over ? { team: over.team.name, rank: over.rank, goalsDiff: over.goalsDiff } : null,
          injuries: count ?? 0,
        });
      }),
    );
    const order = FEATURED_LEAGUES.map((l) => l.slug as string);
    return out.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  },
);
