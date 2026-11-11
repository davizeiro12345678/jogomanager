type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
  loadTimeoutMs?: number;
  maxConcurrentLoads?: number;
type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
  /** Retry a stalled loader without caching its pending promise forever. */
  maxPendingMs?: number;
type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
};

type Entry<T> = {
  promise: Promise<T>;
  expiresAt: number;
type CacheOptions = {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
};

type Entry<T> = {
  promise: Promise<T>;
  expiresAt: number;
};

/**
 * Per-server-instance cache for public projections only. Authenticated saves,
 * permissions, balances and provider credentials must never enter this cache.
 * Both settled values and pending requests count towards its fixed capacity.
 */
};

/**
 * Per-server-instance cache for public projections only. Authenticated saves,
 * permissions, balances and provider credentials must never enter this cache.
 * Both settled values and pending requests count towards its fixed capacity.
 */
export function createPublicReadCache<T>({
  ttlMs,
  maxEntries,
  loadTimeoutMs = 15_000,
  maxConcurrentLoads = 16,
  now = Date.now,
}: CacheOptions) {
  if (
    !Number.isFinite(ttlMs) ||
    ttlMs <= 0 ||
    !Number.isInteger(maxEntries) ||
    maxEntries < 1 ||
    !Number.isFinite(loadTimeoutMs) ||
    loadTimeoutMs < 1 ||
    loadTimeoutMs > 2_147_483_647 ||
    !Number.isInteger(maxConcurrentLoads) ||
    maxConcurrentLoads < 1
  )
    throw new Error("Invalid public cache capacity or freshness.");
  const entries = new Map<string, Entry<T>>();
    throw new Error("Invalid public cache capacity or freshness.");
  const entries = new Map<string, Entry<T>>();
  let pendingLoads = 0;
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
      if (previous && previous.expiresAt > now()) {
        entries.delete(key);
        entries.set(key, previous);
        return previous.promise;
      }
        entries.delete(key);
        entries.set(key, previous);
        return previous.promise;
      }
      // Evicting an entry does not cancel its database request. Track physical
      // loads separately so distinct-key bursts cannot bypass the capacity.
      if (pendingLoads >= maxConcurrentLoads)
        return Promise.reject(new Error("Public data capacity temporarily unavailable."));
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

      let timeout: ReturnType<typeof setTimeout>;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Public data request timed out.")),
          loadTimeoutMs,
        );
      });
      pendingLoads++;
      const upstream = Promise.resolve()
        .then(load)
        .then(
          (value) => {
            pendingLoads--;
            return value;
          },
          (error: unknown) => {
            pendingLoads--;
            throw error;
          },
        );
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
        // A pending request has its own bounded lifetime. The value's TTL
        // still starts on completion; expiration does not cancel old callers.
        expiresAt: now() + maxPendingMs,
        promise: Promise.race([upstream, deadline]),
      };
      entry.promise = entry.promise.then(
        (value) => {
      };
      entry.promise = entry.promise.then(
        (value) => {
          clearTimeout(timeout);
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
            entry.expiresAt = now() + ttlMs;
          }
          return value;
        },
        (error: unknown) => {
            entry.expiresAt = now() + ttlMs;
          }
          return value;
        },
        (error: unknown) => {
          clearTimeout(timeout);
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
  return publicCaches[namespace].get(key, load) as Promise<T>;
}
