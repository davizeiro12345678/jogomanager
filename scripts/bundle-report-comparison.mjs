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


// Two separate build chunks may both be called match-<hash>.js: a tiny lazy
// route wrapper and the full Match 3D client. Hashes can reorder them between
// builds, so selecting the first match would compare unrelated startup costs.
// The largest complete startup closure is the conservative route budget.
export function selectMatchRouteEntry(entries) {
  const matches = entries.filter(isMatchRouteEntry);
  return matches.reduce((largest, entry) => {
    if (!largest) return entry;
    const cost = Number.isFinite(entry.startupGzipBytes)
      ? entry.startupGzipBytes
      : Number.NEGATIVE_INFINITY;
    const previous = Number.isFinite(largest.startupGzipBytes)
      ? largest.startupGzipBytes
      : Number.NEGATIVE_INFINITY;
    return cost > previous ? entry : largest;
  }, undefined);
}
