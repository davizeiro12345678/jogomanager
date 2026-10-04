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
  const source = data.toString();
  const [imports] = parse(source);
  chunks.push({
    name,
    bytes: data.length,
    gzipBytes: gzipSync(data, { level: 9 }).length,
    surface:
      source.includes("SEU CLUBE.") || source.includes("Você é o manager.")
        ? "home"
        : source.includes("Novo treinador") &&
            (source.includes("manager-name") || source.includes("career-step-title"))
          ? "new"
          : null,
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
  .filter(
    (c) =>
      /^(?:client-|index-|new-|dashboard-|match-|partida-rapida-|match\.worker-)/.test(c.name) ||
      c.surface === "home",
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
      surface: c.surface,
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
  const home = entries.find((e) => e.surface === "home");
  const newCareer = entries.find((e) => e.surface === "new");
  const physics = chunks.find(
    (c) => c.name.startsWith("rapier-") && !c.name.startsWith("rapier-ball-"),
  );
  if (
    !physics ||
    physics.bytes > 180_000 ||
    !wasmAssets.some((c) => c.name.startsWith("rapier_wasm3d_bg-"))
  )
    throw new Error("Physics bundle must keep WASM outside JavaScript");
  const crowdWasm = wasmAssets.find((c) => c.name.startsWith("crowd_visibility_wasm_bg-"));
  if (!crowdWasm || crowdWasm.bytes > 96_000)
    throw new Error("Crowd Rust kernel must remain an external WASM asset below 96 KB");
  const forbidden = /^(?:three\.|react-three-|Stadium3D-|PostFX-|rapier-|QuickLive-|crowd_visibility_wasm-)/;
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
  if (
    !home ||
    home.startupBytes > 900_000 ||
    home.dependencies.some((name) => forbidden.test(name) || name.startsWith("leagues-"))
  )
    throw new Error(
      "Home must remain below 900 KB including startup and keep the catalogue/3D out of static dependencies",
    );
  if (
    !newCareer ||
    newCareer.dependencies.some(
      (name) => forbidden.test(name) || name.startsWith("CinematicStage3D-"),
    )
  )
    throw new Error("New career wizard must load the 3D stage on demand");
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
