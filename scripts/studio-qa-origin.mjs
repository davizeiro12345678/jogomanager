/**
 * Only the local, anonymous graphics fixture may feed a CI screenshot. This
 * prevents accidentally capturing authenticated public pages or leaking tokens.
 */
export function studioFixtureUrl(input) {
  let origin;
  try {
    origin = new URL(input);
  } catch {
    throw new Error("Studio QA requires an isolated loopback origin.");
  }
  if (
    origin.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("Studio QA requires an isolated loopback origin.");
  }
  return new URL("/player-studio.html", origin);
}
