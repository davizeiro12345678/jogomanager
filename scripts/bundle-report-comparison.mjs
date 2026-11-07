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
