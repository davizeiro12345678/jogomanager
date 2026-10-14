import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "src/components/game/Stadium3D.tsx",
  "src/components/game/FrameProbe.tsx",
  "src/game/player-materials.ts",
  "src/game/player-instance-batch.ts",
  "src/game/rigid-actor-batch.ts",
  "src/game/athlete-cloth.ts",
  "src/game/player-lod-shorts.ts",
  "src/game/player-shorts.ts",
];

const rows = files.map((relative) => {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const count = (pattern) => source.match(pattern)?.length ?? 0;
  return {
    file: relative,
    disposeCalls: count(/\.dispose\s*\(/g),
    geometryDisposals: count(/(?:geometry|geometries|deformed)\.dispose\s*\(/g),
    materialDisposals: count(/(?:material|mats|set)\.dispose\s*\(/g),
    textureDisposals: count(/(?:texture|tex)\.dispose\s*\(/g),
    refCountSignals: count(/retain|retire|WeakMap|shared|pool|instance/gi),
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  scope: files,
  totalDisposeCalls: rows.reduce((sum, row) => sum + row.disposeCalls, 0),
  rows,
  notes: [
    "Static inventory only; it does not claim runtime ownership for a call site.",
    "player-materials.ts uses ref-counted retain/retire before disposing shared material sets.",
    "The baseline census is the runtime authority for draw/triangle offenders.",
  ],
};

const destination = process.argv[2];
if (destination)
  fs.writeFileSync(path.resolve(root, destination), `${JSON.stringify(report, null, 2)}\n`);
else console.log(JSON.stringify(report, null, 2));
