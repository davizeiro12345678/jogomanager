type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
};

type Entry<T> = {
  promise: Promise<T>;
  expiresAt: number;
  pending: boolean;
};

/**
 * Per-server-instance cache for public projections only. Authenticated saves,
 * permissions, balances and provider credentials must never enter this cache.
 * Both settled values and pending requests count towards its fixed capacity.
 */
export function createPublicReadCache<T>({ ttlMs, maxEntries, now = Date.now }: CacheOptions) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || !Number.isInteger(maxEntries) || maxEntries < 1)
    throw new Error("Invalid public cache capacity or freshness.");
  const entries = new Map<string, Entry<T>>();

  return {
    get size() {
      return entries.size;
    },
    get(key: string, load: () => Promise<T>): Promise<T> {
      const previous = entries.get(key);
      if (previous && (previous.pending || previous.expiresAt > now())) {
        entries.delete(key);
        entries.set(key, previous);
        return previous.promise;
      }
      entries.delete(key);
      while (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);

      const entry: Entry<T> = {
        pending: true,
        expiresAt: 0,
        promise: Promise.resolve().then(load),
      };
      entry.promise = entry.promise.then(
        (value) => {
          // A late request must not resurrect an evicted key or replace a
          // newer request for the same key after capacity eviction.
          if (entries.get(key) === entry) {
            entry.pending = false;
            entry.expiresAt = now() + ttlMs;
          }
          return value;
        },
        (error: unknown) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        },
      );
      entries.set(key, entry);
      return entry.promise;
    },
  };
}

// Separate namespaces prevent unrelated public projections from sharing a key.
// Freshness is deliberately short for sports data; the browser's existing
// private server-function responses continue to use Cache-Control: no-store.
const publicCaches = {
  assets: createPublicReadCache<unknown>({ ttlMs: 60 * 60_000, maxEntries: 1 }),
  squad: createPublicReadCache<unknown>({ ttlMs: 10 * 60_000, maxEntries: 64 }),
  market: createPublicReadCache<unknown>({ ttlMs: 30_000, maxEntries: 256 }),
  league: createPublicReadCache<unknown>({ ttlMs: 5 * 60_000, maxEntries: 16 }),
  club: createPublicReadCache<unknown>({ ttlMs: 5 * 60_000, maxEntries: 128 }),
  digest: createPublicReadCache<unknown>({ ttlMs: 5 * 60_000, maxEntries: 1 }),
};

export function cachedPublicRead<T>(
  namespace: keyof typeof publicCaches,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  return publicCaches[namespace].get(key, load).then((value) => structuredClone(value) as T);
}
