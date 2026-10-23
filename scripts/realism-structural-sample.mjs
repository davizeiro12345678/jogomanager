import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [root, output] = process.argv.slice(2);
const moduleAt = async (name) => import(pathToFileURL(path.join(root, "src/game", name)).href);
const { lookFor, proportionsFor } = await moduleAt("player-model.ts");
const { sculptedHead, sculptedHair } = await moduleAt("player-sculpt.ts");
const { lineCount, narrationLine } = await moduleAt("narration-lines.ts");
const look = lookFor("realism-structure-v1", "MF");
const shape = proportionsFor(look);
const profile = (build) => {
  const times = [];
  let summary;
  for (let i = 0; i < 33; i++) {
    const start = performance.now();
    const geometry = build();
    const ms = performance.now() - start;
    if (i >= 3) times.push(ms);
    summary = {
      vertices: geometry.getAttribute("position").count,
      triangles: (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3,
      normalFinite: Array.from(geometry.getAttribute("normal").array).every(Number.isFinite),
    };
    geometry.dispose();
  }
  times.sort((a, b) => a - b);
  return {
    ...summary,
    samples: times,
    medianMs: times[Math.floor(times.length / 2)],
    p95Ms: times[Math.ceil(times.length * 0.95) - 1],
  };
};
const events = [
  "goal",
  "save",
  "shot",
  "post",
  "chance",
  "corner",
  "sub",
  "foul",
  "card",
  "redCard",
  "kickoff",
  "halftime",
  "fulltime",
];
const report = {
  runtime: process.version,
  fixture: { seed: look.seed, hair: look.hairStyle },
  head: profile(() => sculptedHead(shape, look.seed, true, true)),
  hair: profile(() => sculptedHair(shape, look, true)),
  narration: Object.fromEntries(
    ["pt", "en", "es"].map((lang) => [
      lang,
      {
        total: events.reduce((sum, event) => sum + lineCount(lang, event), 0),
        unique: events.reduce(
          (sum, event) =>
            sum +
            new Set(
              Array.from({ length: lineCount(lang, event) }, (_, index) =>
                narrationLine(lang, event, "Flamengo", index),
              ),
            ).size,
          0,
        ),
        events: Object.fromEntries(events.map((event) => [event, lineCount(lang, event)])),
      },
    ]),
  ),
};
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    root,
    output,
    hairTriangles: report.hair.triangles,
    narration: report.narration,
  }),
);
