import {
  supplementaryFootballJobs,
  AGGREGATE_FOOTBALL_KINDS,
  aggregateFootballRef,
} from "./football-coverage-plan.mjs";
export function createFootballMaterializer({
  upsert,
  teamMap,
  now = Date.now(),
  enrichProfiles = async () => 0,
  enrichVenues = async () => 0,
}) {
  const stamp = () => new Date().toISOString();
  const publishVenues = async (rows) => {
    for (let index = 0; index < rows.length; index += 100)
      await enrichVenues(rows.slice(index, index + 100));
  };
  const raw = (kind, rows) =>
    upsert(
      "api_football_data",
      rows.map(([ref, payload]) => ({ kind, ref: String(ref), payload, updated_at: stamp() })),
    );
  return async (job, body, add) => {
    const list = body.response,
      meta = typeof job.meta === "string" ? JSON.parse(job.meta) : job.meta;
    for (const args of supplementaryFootballJobs(job.kind, list, meta, now)) add(...args);
    if (job.kind === "leagues") {
      await raw(
        "league",
        list.map((x) => [x.league.id, x]),
      );
      await upsert(
        "competitions",
        list.map((x) => ({
          id: `af${x.league.id}`,
          name: x.league.name.slice(0, 120),
          country: x.country.name,
          flag: x.country.flag ?? "",
          tier: 1,
          club_count: 0,
          logo_url: x.league.logo,
          external_source: "api-football",
          external_id: String(x.league.id),
          source_id: String(x.league.id),
          kind: x.league.type === "Cup" ? "national_cup" : "league",
          sync_status: "synced",
        })),
      );
      await upsert(
        "official_leagues",
        list.map((x) => ({
          source_id: `af:${x.league.id}`,
          name: x.league.name,
          sport: "Soccer",
          country: x.country.name,
          current_season: String(
            (x.seasons.find((s) => s.current) ?? x.seasons.at(-1))?.year ?? "",
          ),
          local_competition_id: `af${x.league.id}`,
          updated_at: stamp(),
        })),
      );
      for (const x of list)
        for (const s of x.seasons) {
          const m = { league: x.league.id, season: s.year, current: s.current };
          const priority = s.current ? 10 : 100;
          const query = `league=${m.league}&season=${m.season}`;
          add("/teams?" + query, "teams", m, priority);
          add("/fixtures?" + query, "fixtures", m, priority + 10);
          if (s.coverage?.standings) add("/standings?" + query, "standings", m, priority + 15);
          if (s.coverage?.players)
            add("/players?" + query + "&page=1", "player_stats", m, priority + 30);
          if (s.coverage?.injuries) add("/injuries?" + query, "injury", m, priority + 35);
          for (const [field, kind] of [
            ["top_scorers", "topscorers"],
            ["top_assists", "topassists"],
            ["top_cards", "topyellowcards"],
            ["top_cards", "topredcards"],
          ])
            if (s.coverage?.[field]) add(`/players/${kind}?${query}`, kind, m, priority + 40);
        }
    } else if (job.kind === "teams") {
      await raw(
        "team",
        list.map((x) => [`${x.team.id}:${meta.season}`, x]),
      );
      await upsert(
        "clubs",
        list
          .filter((x) => !teamMap.get(`af:${x.team.id}`)?.local_club_id)
          .map((x) => ({
            id: `af${x.team.id}`,
            competition_id: `af${meta.league}`,
            name: x.team.name.slice(0, 80),
            short_name: (x.team.code ?? x.team.name.slice(0, 3)).toUpperCase().slice(0, 4),
            full_name: x.team.name,
            city: x.venue?.city ?? null,
            country: x.team.country,
            founded: x.team.founded,
            primary_color: "#1f4fa0",
            secondary_color: "#ffffff",
            strength: 55,
            crest_url: x.team.logo,
            data_source: "api-football",
            source_id: String(x.team.id),
            sync_status: "synced",
          })),
      );
      const maps = list.map((x) => ({
        source_id: `af:${x.team.id}`,
        sport: "Soccer",
        league_source_id: teamMap.get(`af:${x.team.id}`)?.league_source_id ?? `af:${meta.league}`,
        name: x.team.name,
        local_club_id: teamMap.get(`af:${x.team.id}`)?.local_club_id ?? `af${x.team.id}`,
        updated_at: stamp(),
      }));
      await upsert("official_teams", maps);
      await publishVenues(
        list.flatMap((row) =>
          row.venue?.id && row.venue?.name
            ? [{ ...row.venue, team_id: row.team.id, country: row.team.country }]
            : [],
        ),
      );
      for (const x of maps) teamMap.set(x.source_id, x);
      for (const x of list) {
        const t = x.team.id;
        add(`/players/squads?team=${t}`, "squad", { team: t }, 25);
        add(`/coachs?team=${t}`, "coach", { team: t }, 60);
        if (x.venue?.id) add(`/venues?id=${x.venue.id}`, "venue", {}, 65);
        add(
          `/teams/statistics?team=${t}&league=${meta.league}&season=${meta.season}`,
          "team_stats",
          { ...meta, team: t },
          meta.current ? 65 : 150,
        );
      }
    } else if (job.kind === "fixtures") {
      await upsert(
        "official_events",
        list.map((f) => ({
          source_id: `af:${f.fixture.id}`,
          league_source_id: `af:${f.league.id}`,
          season: String(f.league.season),
          home_team_source_id: `af:${f.teams.home.id}`,
          away_team_source_id: `af:${f.teams.away.id}`,
          home_team_name: f.teams.home.name,
          away_team_name: f.teams.away.name,
          starts_at: f.fixture.date,
          home_score: f.goals.home,
          away_score: f.goals.away,
          status: f.fixture.status.short,
          venue_source_id: f.fixture.venue.id ? `af:${f.fixture.venue.id}` : null,
          updated_at: stamp(),
        })),
      );
      const ids = [
        ...new Set(
          list
            .filter((f) => ["FT", "AET", "PEN"].includes(f.fixture.status.short))
            .map((f) => f.fixture.id),
        ),
      ];
      for (let k = 0; k < ids.length; k += 20)
        add(
          `/fixtures?ids=${ids.slice(k, k + 20).join("-")}`,
          "fixture_detail",
          meta,
          meta.current ? 70 : 160,
        );
    } else if (job.kind === "squad") {
      await raw(
        "squad",
        list.map((x) => [x.team.id, x]),
      );
      const club = teamMap.get(`af:${meta.team}`)?.local_club_id;
      if (club)
        await upsert(
          "players",
          list
            .flatMap((x) => x.players)
            .filter(
              (p) =>
                p.id &&
                p.name &&
                !/coach|manager|assistant|trainer|staff|physio|technical|treinador|técnico|comissão/i.test(
                  p.position ?? "",
                ),
            )
            .map((p) => ({
              club_id: club,
              name: p.name.slice(0, 80),
              position: p.position?.startsWith("Goal")
                ? "GK"
                : p.position?.startsWith("Def")
                  ? "DF"
                  : p.position?.startsWith("Att")
                    ? "FW"
                    : "MF",
              age: p.age > 14 && p.age < 50 ? p.age : 24,
              shirt_number: p.number > 0 && p.number < 100 ? p.number : null,
              photo_url: p.photo,
              source: "api-football",
              source_kind: "player",
              source_id: String(p.id),
              sync_status: "synced",
            })),
        );
    } else if (AGGREGATE_FOOTBALL_KINDS.has(job.kind)) {
      await raw(job.kind, [[aggregateFootballRef(job.kind, meta), list]]);
    } else if (job.kind === "team_stats") {
      await raw("team_stats", [[`${meta.team}:${meta.league}:${meta.season}`, list]]);
    } else if (["transfer", "trophy", "sidelined"].includes(job.kind)) {
      await raw(job.kind, [[meta.player, list]]);
    } else {
      const rows = list.map((x, i) => {
        const ref =
          job.kind === "league_season"
            ? x
            : job.kind === "team_country"
              ? x.name
              : job.kind === "prediction"
                ? meta.fixture
                : ["odds", "odds_mapping", "live_odds", "live_fixture"].includes(job.kind)
                  ? x.fixture.id
                  : job.kind === "timezone"
                    ? x
                    : job.kind === "country"
                      ? x.name
                      : job.kind === "standings"
                        ? `${meta.league}:${meta.season}`
                        : job.kind === "player_stats"
                          ? `${x.player.id}:${meta.league}:${meta.season}`
                          : job.kind === "injury"
                            ? `${x.player.id}:${x.fixture.id}`
                            : job.kind === "fixture_detail"
                              ? x.fixture.id
                              : job.kind === "player_profile"
                                ? (x.player?.id ?? x.id)
                                : job.kind.startsWith("top")
                                  ? `${x.player.id}:${meta.league}:${meta.season}`
                                  : (x.id ?? x.player?.id ?? `${meta.league}:${meta.season}:${i}`);
        return [ref, x];
      });
      await raw(job.kind, rows);
      if (job.kind === "venue") await publishVenues(list);
      if (["player_profile", "player_stats"].includes(job.kind)) {
        const profiles = list.flatMap((row) => {
          const player = row.player ?? row;
          return Number.isSafeInteger(player.id) && player.id > 0
            ? [
                {
                  source_id: String(player.id),
                  birth_date: player.birth?.date ?? null,
                  photo_url: player.photo ?? null,
                  nationality: player.nationality ?? null,
                },
              ]
            : [];
        });
        for (let index = 0; index < profiles.length; index += 100)
          await enrichProfiles(profiles.slice(index, index + 100));
        for (const x of list) {
          const player = x.player?.id ?? x.id;
          if (!Number.isSafeInteger(player)) continue;
          for (const [endpoint, kind] of [
            ["transfers", "transfer"],
            ["trophies", "trophy"],
            ["sidelined", "sidelined"],
          ])
            add(`/${endpoint}?player=${player}`, kind, { player }, 220);
        }
      }
    }
    const current = Number(new URL(job.path, "https://local").searchParams.get("page") ?? 1);
    if (body.paging) {
      if (body.paging.current !== current) throw new Error("provider_page_mismatch");
      if (current < body.paging.total) {
        const next = new URL(job.path, "https://local");
        next.searchParams.set("page", String(current + 1));
        add(next.pathname + next.search, job.kind, meta, job.priority);
      }
    }
  };
}
