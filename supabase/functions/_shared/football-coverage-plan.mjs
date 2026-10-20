/** Supplement the existing resumable import without re-requesting completed
 * pages. All IDs originate in provider records; no Cartesian league/team fanout. */
export const EXTRA_ROOT_JOBS = [
  ["/leagues/seasons", "league_season"],
  ["/teams/countries", "team_country"],
  ["/odds/bookmakers", "bookmaker"],
  ["/odds/bets", "odds_bet"],
  ["/odds/live/bets", "live_odds_bet"],
  ["/odds/mapping?page=1", "odds_mapping"],
  ["/odds/live", "live_odds"],
  ["/fixtures?live=all", "live_fixture"],
];

export function supplementaryFootballJobs(kind, records, meta = {}, now = Date.now()) {
  const jobs = [];
  const add = (url, kind, meta, priority) => jobs.push([url, kind, meta, priority]);
  if (kind === "leagues") {
    for (const item of records)
      for (const season of item.seasons ?? []) {
        const m = { league: item.league.id, season: season.year, current: season.current };
        const query = `league=${m.league}&season=${m.season}`;
        add(`/fixtures/rounds?${query}`, "fixture_round", m, season.current ? 35 : 135);
        if (season.current && season.coverage?.odds) add(`/odds?${query}&page=1`, "odds", m, 36);
      }
  } else if (kind === "teams") {
    for (const item of records)
      if (Number.isSafeInteger(item.team?.id)) {
        add(`/transfers?team=${item.team.id}`, "team_transfer", { team: item.team.id }, 205);
        add(`/teams/seasons?team=${item.team.id}`, "team_season", { team: item.team.id }, 175);
      }
  } else if (["squad", "player_profile", "player_stats"].includes(kind)) {
    const players = kind === "squad" ? records.flatMap((item) => item.players ?? []) : records;
    for (const item of players) {
      const player = item.player?.id ?? item.id;
      if (!Number.isSafeInteger(player)) continue;
      add(`/players/seasons?player=${player}`, "player_season", { player }, 180);
      add(`/players/teams?player=${player}`, "player_team", { player }, 180);
    }
  } else if (kind === "coach") {
    for (const item of records)
      if (Number.isSafeInteger(item.id)) {
        add(`/trophies?coach=${item.id}`, "coach_trophy", { coach: item.id }, 210);
        add(`/sidelined?coach=${item.id}`, "coach_sidelined", { coach: item.id }, 210);
      }
  } else if (kind === "fixtures") {
    for (const item of records) {
      const date = Date.parse(item.fixture?.date);
      // Predictions and odds cannot reconstruct arbitrarily old snapshots.
      // Limit these requests to the documented upcoming coverage window.
      if (!Number.isFinite(date) || date < now - 86_400_000 || date > now + 14 * 86_400_000)
        continue;
      const fixture = item.fixture.id;
      add(`/predictions?fixture=${fixture}`, "prediction", { fixture }, 37);
      const pair = [item.teams.home.id, item.teams.away.id].sort((a, b) => a - b).join("-");
      add(`/fixtures/headtohead?h2h=${pair}`, "head_to_head", { pair }, 38);
    }
  }
  return jobs;
}

export const AGGREGATE_FOOTBALL_KINDS = new Set([
  "fixture_round",
  "team_transfer",
  "coach_trophy",
  "coach_sidelined",
  "head_to_head",
  "team_season",
  "player_season",
  "player_team",
]);
export function aggregateFootballRef(kind, meta) {
  if (kind === "fixture_round") return `${meta.league}:${meta.season}`;
  if (kind === "team_transfer" || kind === "team_season") return String(meta.team);
  if (kind === "player_season" || kind === "player_team") return String(meta.player);
  if (kind === "head_to_head") return meta.pair;
  return String(meta.coach);
}
