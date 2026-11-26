const matchRouteHelper =
  /^match-(?:command-validation|execution-contract|physics-extras|perception|probability|readiness)(?:-|\.|$)/;

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

// The route wrapper immediately imports the lazy page. Count their combined
// static startup closure instead of selecting whichever hashed name sorts first.
export function isMultiplayerRouteEntry(entry) {
  return (
    typeof entry?.name === "string" &&
    entry.name.startsWith("multiplayer-") &&
    !/^multiplayer-(?:settlement|tickets)(?:-|\.|$)/.test(entry.name)
  );
}

export function findRouteStartup(report, predicate) {
  const entries = report.entries?.filter(predicate) ?? [];
  if (entries.length === 1) {
    const entry = entries[0];
    const related = report.chunks?.filter(predicate) ?? [];
    if (related.some((chunk) => chunk.name !== entry.name)) return undefined;
    if (related.some((chunk) => (chunk.dynamicImports ?? []).some((name) => predicate({ name }))))
      return undefined;
    return entry;
  }
  if (entries.length !== 2 || !Array.isArray(report.chunks)) return undefined;
  const names = new Set(entries.map((entry) => entry.name));
  const links = report.chunks.flatMap((chunk) =>
    names.has(chunk.name)
      ? (chunk.dynamicImports ?? [])
          .filter((name) => names.has(name))
          .map((target) => ({ source: chunk.name, target }))
      : [],
  );
  if (links.length !== 1 || links[0].source === links[0].target) return undefined;
  if (entries.some((entry) => !entry.startupDependencies?.includes(entry.name))) return undefined;
  const dependencies = new Set(entries.flatMap((entry) => entry.startupDependencies));
  const chunks = report.chunks.filter((chunk) => dependencies.has(chunk.name));
  if (
    chunks.length !== dependencies.size ||
    new Set(chunks.map((chunk) => chunk.name)).size !== dependencies.size ||
    chunks.some((chunk) =>
      ["bytes", "gzipBytes", "brotliBytes"].some(
        (key) => !Number.isFinite(chunk[key]) || chunk[key] <= 0,
      ),
    )
  )
    return undefined;
  return {
    startupBytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
    startupGzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
    startupBrotliBytes: chunks.reduce((sum, chunk) => sum + chunk.brotliBytes, 0),
  };
}
