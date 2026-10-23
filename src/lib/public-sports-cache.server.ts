/** Per-worker cache exclusively for public sports projections. Never use for
 * sessions, careers, purchases or provider responses containing private data. */
export class PublicSportsCacheBusyError extends Error {
  constructor() {
    super("O serviço de informações esportivas está ocupado. Tente novamente em instantes.");
    this.name = "PublicSportsCacheBusyError";
  }
}

export function createPublicSportsCache(
  options: {
    ttlMs?: number;
    maxEntries?: number;
    maxBytes?: number;
    /** Public projections only: bounded outage fallback after normal expiry. */
    errorStaleMs?: number;
    now?: () => number;
  } = {},
) {
  // Public league/club projections change on import cycles, not per request.
  // Keep a short stale window while halving repeated Supabase reads vs 30s.
  const ttl = options.ttlMs ?? 60_000;
  const limit = options.maxEntries ?? 64;
  const byteLimit = options.maxBytes ?? 2 * 1024 * 1024;
  const now = options.now ?? Date.now;
  const errorStale = Math.max(0, options.errorStaleMs ?? 0);
  const counters = {
    hits: 0,
    misses: 0,
    coalesced: 0,
    failures: 0,
    staleFallbacks: 0,
    evictions: 0,
    overloads: 0,
  };
  const entries = new Map<
    string,
    { value: unknown; expires: number; bytes: number; retryAfter?: number }
  >();
  const flights = new Map<string, Promise<unknown>>();
  let bytes = 0;
  const remove = (key: string) => {
    const item = entries.get(key);
    if (item) bytes -= item.bytes;
    entries.delete(key);
  };
  return {
    async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);
      if (cached && cached.expires > now()) {
        counters.hits++;
        entries.delete(key);
        entries.set(key, cached);
        return structuredClone(cached.value) as T;
      }
      const canFallback = cached && cached.expires + errorStale > now();
      if (canFallback && (cached.retryAfter ?? 0) > now()) {
        counters.staleFallbacks++;
        return structuredClone(cached.value) as T;
      }
      if (cached && !canFallback) remove(key);
      const pending = flights.get(key);
      if (pending) {
        counters.coalesced++;
        return structuredClone(await pending) as T;
      }
      counters.misses++;
      // Bound origin work as well as bookkeeping: bypassing the map here
      // would allow unlimited distinct misses and skip the stale policy.
      if (flights.size >= limit) {
        counters.overloads++;
        if (canFallback) {
          counters.staleFallbacks++;
          return structuredClone(cached.value) as T;
        }
        throw new PublicSportsCacheBusyError();
      }
      const flight = Promise.resolve()
        .then(loader)
        .then((value) => {
          // Replacements and a successful deletion/missing result release
          // the old value before accounting for its new size.
          remove(key);
          if (value !== null && value !== undefined) {
            const size = new TextEncoder().encode(JSON.stringify(value)).byteLength;
            if (size <= byteLimit) {
              for (const [oldKey, item] of entries)
                if (item.expires + errorStale <= now()) remove(oldKey);
              while (entries.size >= limit || bytes + size > byteLimit) {
                const oldest = entries.keys().next().value;
                if (oldest === undefined) break;
                remove(oldest);
                counters.evictions++;
              }
              const snapshot = structuredClone(value);
              entries.set(key, { value: snapshot, expires: now() + ttl, bytes: size });
              bytes += size;
            }
          }
          return value;
        })
        .catch((error: unknown) => {
          counters.failures++;
          // Normal refresh still waits for the origin. During a short outage
          // a known public snapshot can survive, with a two-second backoff
          // rather than another database request from every retrying view.
          if (cached && cached.expires + errorStale > now()) {
            cached.retryAfter = Math.min(cached.expires + errorStale, now() + 2_000);
            counters.staleFallbacks++;
            return cached.value;
          }
          throw error;
        });
      flights.set(key, flight);
      try {
        return structuredClone(await flight) as T;
      } finally {
        flights.delete(key);
      }
    },
    stats: () => ({ entries: entries.size, bytes, inFlight: flights.size }),
    metrics: () => ({ ...counters }),
  };
}

export const publicSportsCache = createPublicSportsCache({ errorStaleMs: 120_000 });
