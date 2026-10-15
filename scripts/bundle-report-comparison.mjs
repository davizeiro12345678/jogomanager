export function isMatchRouteEntry(entry) {
  return entry.name.startsWith("match-") && !entry.name.startsWith("match-command-validation-");
}
