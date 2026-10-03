export interface TextureFailure {
  attempts: number;
  retryAt: number;
  permanent: boolean;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 30_000;

/** Immutable missing assets cannot recover by retrying them every rig mount. */
export function textureFailureAfter(
  previous: TextureFailure | undefined,
  now: number,
  status?: number,
): TextureFailure {
  const attempts = (previous?.attempts ?? 0) + 1;
  return {
    attempts,
    retryAt: now + BACKOFF_MS * 2 ** (attempts - 1),
    permanent: status === 404 || status === 410 || status === 401 || status === 403,
  };
}

export function canRequestTexture(failure: TextureFailure | undefined, now: number): boolean {
  return (
    !failure || (!failure.permanent && failure.attempts < MAX_ATTEMPTS && now >= failure.retryAt)
  );
}

/** Schedules one bounded retry and returns a cleanup function for scene disposal. */
export function scheduleTextureRetry(
  failure: TextureFailure,
  now: number,
  retry: () => void,
): (() => void) | null {
  if (!canRequestTexture(failure, failure.retryAt)) return null;
  const timer = globalThis.setTimeout(retry, Math.max(0, failure.retryAt - now));
  return () => globalThis.clearTimeout(timer);
}

/** Three FileLoader's HTTP errors carry the failed Response. */
export function textureHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) return undefined;
  const response = error.response;
  if (!response || typeof response !== "object" || !("status" in response)) return undefined;
  return typeof response.status === "number" ? response.status : undefined;
}
