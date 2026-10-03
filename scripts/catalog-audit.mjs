import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({ configFile: false, appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true } });
const { LEAGUES, CLUBS } = await server.ssrLoadModule('/src/game/data/leagues.ts');
const { buildSquad } = await server.ssrLoadModule('/src/game/squad.ts');
const { NAMED_SQUADS } = await server.ssrLoadModule('/src/game/data/squads.ts');
const leagues = LEAGUES.map(({ id, name, country, clubs }) => ({
  id, name, country, count: clubs.length,
  clubs: clubs.map(({ id, name }) => ({ id, name })),
}));
const rosters = Object.keys(CLUBS).map((id) => {
  const squad = buildSquad(id);
  return { id, players: squad.length, goalkeepers: squad.filter((p) => p.pos === "GK").length,
    named: NAMED_SQUADS[id]?.split(";").length ?? 0 };
});
const report = { generatedAt: new Date().toISOString(), leagues, rosters,
  totals: { leagues: leagues.length, clubs: rosters.length,
    activeClubs: new Set(leagues.flatMap(l=>l.clubs.map(c=>c.id))).size,
    clubEntries: leagues.reduce((s,l)=>s+l.clubs.length,0),
    sourcedLeagues: LEAGUES.filter(l=>l.catalogStatus==='sourced').length,
    players: rosters.reduce((s, r) => s + r.players, 0) } };
const label = process.argv[2] ?? "current";
const outputDir = path.join(root, "verification/catalog-2026-10-02");
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, `${label}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ totals: report.totals,
  leagueSizes: leagues.map(({ id, country, name, count }) => ({ id, country, name, count })),
  rosterSizes: [...new Set(rosters.map((r) => r.players))] }, null, 2));
await server.close();
