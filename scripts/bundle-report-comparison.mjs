export function isMatchRouteEntry(entry) {
  // Rolldown emits this route as match-<8-character hash>.js. Similar names
  // such as match-ai.functions-<hash>.js are separate modules, not the route.
  return /^match-[A-Za-z0-9_-]{8}\.js$/.test(entry.name);
}
