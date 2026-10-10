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

/**
 * A procedural map is expensive to paint on the main thread. Keep its
 * lightweight neutral replacement while a compressed asset can still arrive,
 * and only pay for the procedural fallback after the request has exhausted
 * every bounded retry.
 */
export function needsProceduralTextureFallback(failure: TextureFailure | undefined): boolean {
  return Boolean(failure && !canRequestTexture(failure, Number.POSITIVE_INFINITY));
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
  if (!error || typeof error !== "object") return undefined;
  // FileLoader can return a Response-like error, while browsers commonly
  // surface the failed XMLHttpRequest as target/currentTarget of ProgressEvent.
  // Treat both forms the same so immutable 404/403 assets immediately unlock
  // the cached procedural fallback instead of wasting three delayed retries.
  for (const key of ["response", "target", "currentTarget"] as const) {
    const candidate = (error as { response?: unknown; target?: unknown; currentTarget?: unknown })[
      key
    ];
    if (
      candidate &&
      typeof candidate === "object" &&
      "status" in candidate &&
      typeof candidate.status === "number"
    )
      return candidate.status;
  }
  return undefined;
}
