import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { init, parse } from "es-module-lexer";

// Measures emitted code, following only static imports. Dynamic imports stay
// separate so a smaller entry cannot hide an equally large startup dependency.
const [label = "current", assetsArg = ".output/public/assets"] = process.argv.slice(2);
const assets = path.resolve(assetsArg);
await init;
const chunks = [];
const wasmAssets = [];
for (const name of await readdir(assets)) {
  if (name.endsWith(".wasm")) {
    const data = await readFile(path.join(assets, name));
    wasmAssets.push({ name, bytes: data.length, gzipBytes: gzipSync(data, { level: 9 }).length });
  }
  if (!name.endsWith(".js")) continue;
  const data = await readFile(path.join(assets, name));
  const [imports] = parse(data.toString());
  chunks.push({
    name,
    bytes: data.length,
    gzipBytes: gzipSync(data, { level: 9 }).length,
    imports: imports
      .filter((i) => i.d === -1 && i.n?.startsWith("."))
      .map((i) => path.basename(i.n)),
    dynamicImports: imports
      .filter((i) => i.d >= 0 && i.n?.startsWith("."))
      .map((i) => path.basename(i.n)),
  });
}
const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
const closure = (entry) => {
  const seen = new Set();
  const visit = (name) => {
    if (seen.has(name) || !byName.has(name)) return;
    seen.add(name);
    byName.get(name).imports.forEach(visit);
  };
  visit(entry);
  return [...seen];
};
const root = chunks.find((c) => c.dynamicImports.some((name) => name.startsWith("dashboard-")));
const rootDependencies = root ? closure(root.name) : [];
const entries = chunks
  .filter((c) =>
    /^(?:client-|index-|dashboard-|match-|partida-rapida-|match\.worker-)/.test(c.name),
  )
  .map((c) => {
    const dependencies = closure(c.name);
    const startupDependencies = [
      ...new Set([
        ...dependencies,
        ...(c.name.startsWith("match.worker-") ? [] : rootDependencies),
      ]),
    ];
    return {
      name: c.name,
      bytes: c.bytes,
      gzipBytes: c.gzipBytes,
      staticBytes: dependencies.reduce((sum, name) => sum + byName.get(name).bytes, 0),
      staticGzipBytes: dependencies.reduce((sum, name) => sum + byName.get(name).gzipBytes, 0),
      dependencies,
      startupBytes: startupDependencies.reduce((sum, name) => sum + byName.get(name).bytes, 0),
      startupGzipBytes: startupDependencies.reduce(
        (sum, name) => sum + byName.get(name).gzipBytes,
        0,
      ),
      startupDependencies,
    };
  });
const report = {
  label,
  generatedAt: new Date().toISOString(),
  assets,
  totalBytes: chunks.reduce((sum, c) => sum + c.bytes, 0),
  totalGzipBytes: chunks.reduce((sum, c) => sum + c.gzipBytes, 0),
  wasmAssets,
  entries,
  chunks: chunks.sort((a, b) => b.bytes - a.bytes),
};
if (process.argv.includes("--check")) {
  const worker = entries.find((e) => e.name.startsWith("match.worker-"));
  const quick = entries.find((e) => e.name.startsWith("partida-rapida-"));
  const physics = chunks.find(
    (c) => c.name.startsWith("rapier-") && !c.name.startsWith("rapier-ball-"),
  );
  if (
    !physics ||
    physics.bytes > 180_000 ||
    !wasmAssets.some((c) => c.name.startsWith("rapier_wasm3d_bg-"))
  )
    throw new Error("Physics bundle must keep WASM outside JavaScript");
  const forbidden = /^(?:three\.|react-three-|Stadium3D-|PostFX-|rapier-|QuickLive-)/;
  if (
    !root ||
    root.bytes > 430_000 ||
    rootDependencies.some((name) => forbidden.test(name) || name.startsWith("leagues-"))
  )
    throw new Error("Startup bundle budget failed");
  if (!worker || worker.staticBytes > 90_000)
    throw new Error("Simulation worker startup budget failed");
  if (
    !quick ||
    quick.startupBytes > 1_150_000 ||
    quick.dependencies.some((name) => forbidden.test(name))
  )
    throw new Error("Quick match selection bundle budget failed");
}
const output = path.resolve("verification/bundle-2026-10-01", `${label}.json`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      output,
      totalBytes: report.totalBytes,
      totalGzipBytes: report.totalGzipBytes,
      entries,
      largest: report.chunks.slice(0, 10),
    },
    null,
    2,
  ),
);
