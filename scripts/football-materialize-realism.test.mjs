import test from "node:test";
import assert from "node:assert/strict";
import { createFootballMaterializer } from "../supabase/functions/_shared/football-materialize.mjs";

test("Edge team import retains both team links when clubs share a venue", async () => {
  const projections = [];
  const materialize = createFootballMaterializer({
    upsert: async () => {},
    teamMap: new Map(),
    enrichVenues: async (rows) => {
      projections.push(...rows);
    },
  });
  const venue = {
    id: 204,
    name: "Shared ground",
    city: "City",
    capacity: 50000,
    image: "https://images.example/ground.png",
  };
  await materialize(
    { kind: "teams", path: "/teams?league=39", meta: { league: 39, season: 2026 } },
    {
      response: [
        { team: { id: 33, name: "One", country: "England" }, venue },
        { team: { id: 34, name: "Two", country: "England" }, venue },
      ],
    },
    () => {},
  );
  assert.equal(projections.length, 2);
  assert.deepEqual(
    projections.map((row) => row.team_id),
    [33, 34],
  );
  assert.ok(projections.every((row) => row.id === 204));
});

test("Edge profile enrichment stays bounded and propagates an enrichment failure", async () => {
  const batches = [];
  const materialize = createFootballMaterializer({
    upsert: async () => {},
    teamMap: new Map(),
    enrichProfiles: async (profiles) => {
      batches.push(profiles);
      return profiles.length;
    },
  });
  const response = Array.from({ length: 205 }, (_, index) => ({
    player: {
      id: index + 1,
      birth: { date: "2000-01-01" },
      photo: "https://images.example/player.png",
    },
  }));
  await materialize(
    { kind: "player_profile", path: "/players/profiles?page=1", meta: {} },
    { response },
    () => {},
  );
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [100, 100, 5],
  );
  assert.deepEqual(batches[0][0], {
    source_id: "1",
    birth_date: "2000-01-01",
    photo_url: "https://images.example/player.png",
    nationality: null,
  });
  const broken = createFootballMaterializer({
    upsert: async () => {},
    teamMap: new Map(),
    enrichProfiles: async () => {
      throw new Error("enrichment failed");
    },
  });
  await assert.rejects(
    () =>
      broken(
        { kind: "player_profile", path: "/players/profiles", meta: {} },
        { response: response.slice(0, 1) },
        () => {},
      ),
    /enrichment failed/,
  );
});

test("Edge importer preserves football classification and stable team mapping", async () => {
  const writes = [];
  const materialize = createFootballMaterializer({
    upsert: async (table, rows) => writes.push({ table, rows }),
    teamMap: new Map(),
  });
  await materialize(
    { kind: "teams", meta: { league: 39, season: 2026 } },
    {
      response: [
        {
          team: {
            id: 33,
            name: "Test Club",
            country: "England",
            logo: "https://images.example/team.png",
          },
          venue: { city: "City" },
        },
      ],
    },
    () => {},
  );
  assert.equal(writes.find((x) => x.table === "official_teams").rows[0].sport, "Soccer");
  assert.equal(writes.find((x) => x.table === "official_teams").rows[0].source_id, "af:33");
});

test("Edge squad import excludes technical staff and marks player records", async () => {
  const writes = [];
  const materialize = createFootballMaterializer({
    upsert: async (table, rows) => writes.push({ table, rows }),
    teamMap: new Map([["af:33", { local_club_id: "club" }]]),
  });
  await materialize(
    { kind: "squad", meta: { team: 33 } },
    {
      response: [
        {
          team: { id: 33 },
          players: [
            { id: 1, name: "Real Player", position: "Attacker" },
            { id: 2, name: "Coach", position: "Coach" },
          ],
        },
      ],
    },
    () => {},
  );
  const players = writes.find((x) => x.table === "players").rows;
  assert.equal(players.length, 1);
  assert.equal(players[0].source_kind, "player");
  assert.equal(players[0].source_id, "1");
});
