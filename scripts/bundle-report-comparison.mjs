export function isMatchRouteEntry(entry) {
  // Vite emits an eight-character content hash. Prefix matching also accepted
  // match-analytics and other helpers, understating the actual route startup.
  return /^match-[A-Za-z0-9_-]{8}\.js$/.test(entry.name);
}
