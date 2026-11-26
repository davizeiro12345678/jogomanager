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
