// Public league membership snapshots. Sequential, bounded and resumable;
// API keys, private responses and artwork are never written to the catalog.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { decodeHTML } from "entities";
import { BASE_SOURCES } from "./catalog-sources.mjs";
const dir = "verification/catalog-2026-10-02/sources";
await mkdir(dir, { recursive: true });
const clean = (s) => decodeHTML(s.replace(/<[^>]*>/g, "").trim());
const indexPath = `${dir}/index.json`;
let index;
try {
  index = JSON.parse(await readFile(indexPath, "utf8"));
  if (!index.length) throw Error("empty");
} catch {
  const html = await (await fetch("https://www.thesportsdb.com/sport/leagues?all=1")).text();
  index = [...html.matchAll(/href=['"]((?:\.\.)?\/league\/(\d+)-[^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({
      id: m[2],
      path: m[1].replace(/^\.\./, ""),
      name: clean(m[3]).replace(/\s+/g, " "),
    }))
    .filter((x) => x.name);
  index = [...new Map(index.map((x) => [x.id, x])).values()];
  await writeFile(indexPath, JSON.stringify(index, null, 2));
}
const baseline = JSON.parse(
  await readFile("verification/catalog-2026-10-02/baseline.json", "utf8"),
);
const wanted = new Set(baseline.leagues.map((l) => l.id.match(/^[xy](\d+)/)?.[1]).filter(Boolean));
Object.values(BASE_SOURCES).forEach((id) => wanted.add(id));
// First and second divisions whose game identifiers predate the source IDs.
["4683", "5746", "5748", "4952", "4951", "5072"].forEach((id) => wanted.add(id));
const queue = index.filter((x) => wanted.has(x.id));
const limit = Number(process.argv[2] ?? queue.length);
let fetched = 0,
  failures = 0;
for (const x of queue) {
  try {
    const cached = JSON.parse(await readFile(`${dir}/${x.id}.json`, "utf8"));
    if (!cached.teams.length || cached.teams[0].slug) continue;
  } catch {}
  if (fetched >= limit) break;
  try {
    const response = await fetch(`https://www.thesportsdb.com${x.path}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const html = await response.text();
    const start = html.indexOf("id='teamImages'");
    const section = start < 0 ? "" : html.slice(start, html.indexOf("</table>", start));
    const teams = [
      ...section.matchAll(/href=['"]\/team\/(\d+)-([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g),
    ].map((m) => ({ id: m[1], slug: decodeURIComponent(m[2]), name: clean(m[3]) }));
    const field = (label) =>
      clean(html.match(new RegExp(`<b>${label}</b><br>(.*?)<br>`))?.[1] ?? "");
    const record = {
      ...x,
      url: response.url,
      retrievedAt: new Date().toISOString(),
      season: field("Current Season"),
      gender: field("Gender"),
      sport: field("Sport"),
      country: field("Country"),
      teams: [...new Map(teams.map((t) => [t.id, t])).values()],
    };
    await writeFile(`${dir}/${x.id}.json`, JSON.stringify(record, null, 2) + "\n");
    fetched++;
    console.log(`${x.id} ${x.name}: ${record.teams.length} (${record.season}; ${record.gender})`);
  } catch (e) {
    failures++;
    console.log(`${x.id}: ${e.message}`);
  }
  await delay(2200);
}
console.log(JSON.stringify({ fetched, failures, queued: queue.length }));
