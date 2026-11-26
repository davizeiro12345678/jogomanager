const matchRouteHelper =
  /^match-(?:command-validation|execution-contract|physics-extras|probability|readiness)(?:-|\.|$)/;

export function isMatchRouteEntry(entry) {
  if (entry?.surface === "match") return true;
  return (
    typeof entry?.name === "string" &&
    entry.name.startsWith("match-") &&
    !matchRouteHelper.test(entry.name)
  );
}

const isEditorChunk = (name) => typeof name === "string" && name.startsWith("editor-");

export function findEditorLayers(report) {
  const entries = report.entries?.filter((entry) => isEditorChunk(entry.name)) ?? [];
  const chunks = report.chunks?.filter((chunk) => isEditorChunk(chunk.name));
  if (chunks && entries.length !== chunks.length) return undefined;

  // The route wrapper dynamically imports the page with the same chunk prefix.
  // Older builds emit the route and page together.
  const links =
    chunks?.flatMap((chunk) =>
      (chunk.dynamicImports ?? [])
        .filter(isEditorChunk)
        .map((target) => ({ source: chunk.name, target })),
    ) ?? [];
  if (entries.length === 1 && links.length === 0) return { page: entries[0] };
  if (entries.length !== 2 || links.length !== 1) return undefined;

  const [{ source, target }] = links;
  if (source === target) return undefined;
  const wrapper = entries.find((entry) => entry.name === source);
  const page = entries.find((entry) => entry.name === target);
  return wrapper && page ? { wrapper, page } : undefined;
}

export function measureEditorStartup(report, layers) {
  if (!layers?.wrapper) return layers?.page;
  const { wrapper, page } = layers;
  if (
    !wrapper.startupDependencies?.includes(wrapper.name) ||
    !page.startupDependencies?.includes(page.name)
  )
    return undefined;

  const names = new Set([...wrapper.startupDependencies, ...page.startupDependencies]);
  const chunks = report.chunks.filter((chunk) => names.has(chunk.name));
  if (
    chunks.length !== names.size ||
    new Set(chunks.map((chunk) => chunk.name)).size !== names.size ||
    chunks.some(
      (chunk) =>
        !Number.isFinite(chunk.gzipBytes) ||
        chunk.gzipBytes <= 0 ||
        !Number.isFinite(chunk.brotliBytes) ||
        chunk.brotliBytes <= 0,
    )
  )
    return undefined;
  return {
    startupGzipBytes: chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0),
    startupBrotliBytes: chunks.reduce((total, chunk) => total + chunk.brotliBytes, 0),
  };
}

/**
 * Two `match-*` entries exist: the Match 3D surface (simulation worker, HUD,
 * live match) and a lighter sibling. Hashed names cannot identify either across
 * builds, so picking the first match compared 158 KB with 580 KB whenever the
 * hash order flipped. The selector follows the route itself: the entry whose
 * startup graph boots the 3D match surface, falling back to the largest graph.
 */
const matchSurfaceDependency =
  /^(?:simWorkerClient|MatchHud|MatchMinimap|MatchLoading|MatchScoreLine|live-match|physics-quality|CutsceneStage|Cutscene)-/;
const threeRuntimeDependency = /^(?:three(?:\.core)?|react-three-fiber|rapier)-/i;
const startupDependencies = (entry) =>
  Array.isArray(entry?.startupDependencies) ? entry.startupDependencies : [];
const bootsMatchSurface = (entry) =>
  startupDependencies(entry).some(
    (dependency) =>
      matchSurfaceDependency.test(String(dependency)) ||
      threeRuntimeDependency.test(String(dependency)),
  );
const largestStartup = (entries) =>
  entries.reduce((best, entry) =>
    (entry.startupGzipBytes ?? 0) > (best.startupGzipBytes ?? 0) ? entry : best,
  );
export function pickMatchRouteEntry(entries) {
  const candidates = (entries ?? []).filter(isMatchRouteEntry);
  if (candidates.length <= 1) return candidates[0];
  const matchSurface = candidates.filter(bootsMatchSurface);
  return largestStartup(matchSurface.length > 0 ? matchSurface : candidates);
}

// Route filenames are content-hashed. Only the hydration import identifies the
// wrapper; a lazy page is mandatory work, while its optional drawers/match are not.
export function measureBrowserRoute(report, prefix) {
  const matches = (name) => name.startsWith(prefix);
  const entries = report.entries ?? [];
  const chunks = report.chunks ?? [];
  const hydration = chunks.filter((chunk) => chunk.name.startsWith("hydrate-app-"));
  if (!hydration.length) {
    // Historical reports lack the wrapper graph. Retain the Match surface
    // identity used by earlier report consumers.
    if (prefix === "match-") return pickMatchRouteEntry(entries);
    const candidates = entries.filter((entry) => matches(entry.name));
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  if (hydration.length !== 1) return undefined;
  const roots = [...new Set(hydration[0].dynamicImports.filter(matches))];
  if (roots.length !== 1) return undefined;
  const wrappers = entries.filter((entry) => entry.name === roots[0]);
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const root = byName.get(roots[0]);
  if (byName.size !== chunks.length || wrappers.length !== 1 || !root) return undefined;
  const [wrapper] = wrappers;
  const isPage = (name) =>
    matches(name) || (prefix === "partida-rapida-" && name.startsWith("QuickMatchPage-"));
  const targets = [...new Set(root.dynamicImports.filter(isPage))];
  if (!targets.length) return wrapper;
  if (targets.length !== 1 || !wrapper.startupDependencies?.includes(root.name)) return undefined;
  const page = byName.get(targets[0]);
  if (!page || page.name === root.name || page.dynamicImports.some(isPage)) return undefined;

  const dependencies = new Set(wrapper.dependencies);
  const startup = new Set(wrapper.startupDependencies);
  const pending = [page.name];
  const visited = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (visited.has(name)) continue;
    visited.add(name);
    const chunk = byName.get(name);
    if (!chunk || !Array.isArray(chunk.imports)) return undefined;
    dependencies.add(name);
    startup.add(name);
    pending.push(...chunk.imports);
  }
  const metrics = { startupBytes: 0, startupGzipBytes: 0, startupBrotliBytes: 0 };
  for (const name of startup) {
    const chunk = byName.get(name);
    if (
      !chunk ||
      ![chunk.bytes, chunk.gzipBytes, chunk.brotliBytes].every((v) => Number.isFinite(v) && v > 0)
    )
      return undefined;
    metrics.startupBytes += chunk.bytes;
    metrics.startupGzipBytes += chunk.gzipBytes;
    metrics.startupBrotliBytes += chunk.brotliBytes;
  }
  return {
    ...metrics,
    name: page.name,
    dependencies: [...dependencies],
    startupDependencies: [...startup],
  };
}
