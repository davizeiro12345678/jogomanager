/** Only local destinations are accepted, including after OAuth callbacks. */
export function safeAuthNext(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    return undefined;
  try {
    const base = "https://auth.invalid";
    const url = new URL(value, base);
    // The normalized pathname will be used as a fresh navigation target.
    if (url.origin !== base || url.pathname.startsWith("//")) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}
