import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

// Measure Brotli as a CDN transport estimate; this does not enable the
// Content-Encoding header on the host. Verify the live response separately.
const brotliBytes = (data) =>
  brotliCompressSync(data, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
  }).length;
import { init, parse } from "es-module-lexer";

const cinematicSetChunkPrefixes = [
  { set: "locker", prefix: "LockerRoom-" },
  { set: "tunnel", prefix: "Tunnel-" },
  { set: "press", prefix: "PressRoom-" },
  { set: "pitch", prefix: "PitchEntry-" },
  { set: "stands", prefix: "Stands-" },
  { set: "office", prefix: "Office-" },
  { set: "arrival", prefix: "BusArrival-" },
];

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
    wasmAssets.push({
      name,
      bytes: data.length,
      gzipBytes: gzipSync(data, { level: 9 }).length,
      brotliBytes: brotliBytes(data),
    });
  }
  if (!name.endsWith(".js")) continue;
  const data = await readFile(path.join(assets, name));
  const source = data.toString();
  const [imports] = parse(source);
  chunks.push({
    name,
    bytes: data.length,
    gzipBytes: gzipSync(data, { level: 9 }).length,
    brotliBytes: brotliBytes(data),
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
const cinematicStageChunk = chunks.find((chunk) => chunk.name.startsWith("CinematicStage3D-"));
const cinematicStageDependencies = cinematicStageChunk ? closure(cinematicStageChunk.name) : [];
const cinematicStageDynamicDependencies = cinematicStageChunk
  ? cinematicStageChunk.dynamicImports
  : [];
const cinematicSetChunks = cinematicSetChunkPrefixes.map(({ set, prefix }) => {
  const chunk = chunks.find((candidate) => candidate.name.startsWith(prefix));
  return {
    set,
    name: chunk?.name ?? null,
    bytes: chunk?.bytes ?? null,
    gzipBytes: chunk?.gzipBytes ?? null,
    brotliBytes: chunk?.brotliBytes ?? null,
  };
});
const entries = chunks
  .filter(
    (c) =>
      /^(?:client-|index-|new-|dashboard-|editor-|jogador\.painel-|jogador\.index-|match-|partida-rapida-|match\.worker-|CinematicStage3D-)/.test(
        c.name,
      ) || c.surface === "home",
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
      brotliBytes: c.brotliBytes,
      staticBytes: dependencies.reduce((sum, name) => sum + byName.get(name).bytes, 0),
      staticGzipBytes: dependencies.reduce((sum, name) => sum + byName.get(name).gzipBytes, 0),
      staticBrotliBytes: dependencies.reduce((sum, name) => sum + byName.get(name).brotliBytes, 0),
      dependencies,
      startupBytes: startupDependencies.reduce((sum, name) => sum + byName.get(name).bytes, 0),
      startupGzipBytes: startupDependencies.reduce(
        (sum, name) => sum + byName.get(name).gzipBytes,
        0,
      ),
      startupBrotliBytes: startupDependencies.reduce(
        (sum, name) => sum + byName.get(name).brotliBytes,
        0,
      ),
      startupDependencies,
    };
  });
const cinematicStage = entries.find((entry) => entry.name.startsWith("CinematicStage3D-"));
const validateCinematicStageSplitting = () => {
  if (!cinematicStage)
    throw new Error("Cinematic stage must be reported with its static startup closure");
  const expectedSetNames = cinematicSetChunkPrefixes.map(({ prefix }) => prefix);
  const missingCinematicSets = cinematicSetChunks.filter(
    (chunk) => !chunk.name || !cinematicStageDynamicDependencies.includes(chunk.name),
  );
  const staticCinematicSets = cinematicStage.dependencies.filter((name) =>
    expectedSetNames.some((prefix) => name.startsWith(prefix)),
  );
  if (missingCinematicSets.length || staticCinematicSets.length)
    throw new Error(
      `Cinematic environments must emit as on-demand chunks outside the stage static closure (missing: ${missingCinematicSets.map((chunk) => chunk.set).join(", ") || "none"}; static: ${staticCinematicSets.join(", ") || "none"})`,
    );
};
const report = {
  label,
  generatedAt: new Date().toISOString(),
  assets,
  totalBytes: chunks.reduce((sum, c) => sum + c.bytes, 0),
  totalGzipBytes: chunks.reduce((sum, c) => sum + c.gzipBytes, 0),
  totalBrotliBytes: chunks.reduce((sum, c) => sum + c.brotliBytes, 0),
  wasmAssets,
  cinematicStage: cinematicStageChunk
    ? {
        name: cinematicStageChunk.name,
        staticDependencies: cinematicStageDependencies,
        dynamicDependencies: cinematicStageDynamicDependencies,
      }
    : null,
  cinematicSetChunks,
  entries,
  chunks: chunks.sort((a, b) => b.bytes - a.bytes),
};
if (process.argv.includes("--check")) {
  const worker = entries.find((e) => e.name.startsWith("match.worker-"));
  const quick = entries.find((e) => e.name.startsWith("partida-rapida-"));
  const home = entries.find((e) => e.surface === "home");
  const newCareer = entries.find((e) => e.surface === "new");
  const playerCareer = entries.find((e) => e.name.startsWith("jogador.painel-"));
  const editor = entries.find((e) => e.name.startsWith("editor-"));
  const match = entries.find((e) => e.name.startsWith("match-"));
  const matchReport = chunks.find((c) => c.name.startsWith("MatchReport-"));
  const deferredEditorTabs = /^(?:roster-|clubs-|competitions-|import-export-)/;
  if (
    !editor ||
    editor.staticBytes > 500_000 ||
    editor.dependencies.some((name) => deferredEditorTabs.test(name))
  )
    throw new Error("Editor must keep its heavy tabs split from the route startup chunk");
  if (!match || !matchReport || match.dependencies.includes(matchReport.name))
    throw new Error("Match report must remain an on-demand chunk until the match finishes");
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
  validateCinematicStageSplitting();
  const forbidden =
    /^(?:three\.|react-three-|Stadium3D-|PostFX-|rapier-|QuickLive-|crowd_visibility_wasm-)/;
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
  const deferredAthleteVisuals =
    /^(?:AthleteHero3D-|PlayerCalendarTab-|PlayerHealthTab-|PlayerNationalTab-|PlayerContractTab-|PlayerHistoryTab-)/;
  if (
    !playerCareer ||
    playerCareer.dependencies.some((name) => deferredAthleteVisuals.test(name))
  ) {
    throw new Error("Player career must load heavy 3D and secondary panels on demand");
  }
}
if (process.argv.includes("--check-cinematic")) validateCinematicStageSplitting();
const output = path.resolve("verification/bundle-2026-10-01", `${label}.json`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      output,
      totalBytes: report.totalBytes,
      totalGzipBytes: report.totalGzipBytes,
      totalBrotliBytes: report.totalBrotliBytes,
      gzipToBrotliSavingsPercent:
        report.totalGzipBytes > 0
          ? Math.round((1 - report.totalBrotliBytes / report.totalGzipBytes) * 10000) / 100
          : 0,
      entries,
      largest: report.chunks.slice(0, 10),
    },
    null,
    2,
  ),
);
