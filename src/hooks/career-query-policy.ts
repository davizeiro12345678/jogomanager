/**
 * Network failures already fall back to the local save. A rejected local shape
 * or failed recovery write needs an actionable error, not automatic retries.
 * Nested shells also read the career: retrying on their mount would alternate
 * loading/error shells forever. Explicit refetch and confirmed restore work.
 */
export const careerQueryPolicy = { retry: false, retryOnMount: false } as const;

export function careerQueryEnabled(authReady: boolean, status?: string): boolean {
  // Each reader resolves Auth independently. An enabled:false -> true account
  // transition can fetch even with retryOnMount:false; retain cached failures
  // until explicit recovery/refetch, rather than remounting a loading shell.
  return authReady && status !== "error";
}
