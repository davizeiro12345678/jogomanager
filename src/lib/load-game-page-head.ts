/** TanStack awaits head metadata. Public pages need no gameplay title catalogue. */
export async function loadGamePageHead(path: string) {
  const { gamePageHead } = await import("./game-page-metadata");
  return gamePageHead(path);
}
