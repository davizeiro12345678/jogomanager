import { loadEnv } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
const env = loadEnv("development", process.cwd(), "");
const key = process.env.THESPORTSDB_API_KEY ?? env.THESPORTSDB_API_KEY;
console.log(JSON.stringify({ configuredPremium: Boolean(key && key !== "123") }));
await mkdir("verification/catalog-2026-10-02", { recursive: true });
for (const leagueId of ["4396", "5079", "4328"]) {
  const url =
    key && key !== "123"
      ? `https://www.thesportsdb.com/api/v2/json/list/teams/${leagueId}`
      : `https://www.thesportsdb.com/api/v1/json/123/search_all_teams.php?l=${leagueId}`;
  try {
    const response = await fetch(url, {
      headers: key && key !== "123" ? { "X-API-KEY": key } : {},
      signal: AbortSignal.timeout(20000),
    });
    const data = response.ok ? await response.json() : null;
    const list = (data && Object.values(data).find(Array.isArray)) || [];
    const teams = list.map((t) => ({
      id: t.idTeam,
      name: t.strTeam,
      leagueId: t.idLeague,
      league: t.strLeague,
      alternate: t.strTeamAlternate,
    }));
    await writeFile(
      `verification/catalog-2026-10-02/probe-${leagueId}.json`,
      JSON.stringify({ leagueId, status: response.status, teams }, null, 2),
    );
    console.log(
      JSON.stringify({
        leagueId,
        status: response.status,
        count: teams.length,
        sample: teams.slice(0, 3),
      }),
    );
    if (response.status === 429) break;
  } catch (error) {
    console.log(JSON.stringify({ leagueId, error: error.name }));
  }
  await new Promise((resolve) => setTimeout(resolve, 2200));
}
