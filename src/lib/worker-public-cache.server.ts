type Options = {
  ttlMs: number;
  staleIfErrorMs: number;
  maxEntries: number;
  now?: () => number;
};
type Entry<T> = { value: T; expiresAt: number };

/** Worker isolates may outlive a canceled invocation. Retain only completed
 * public data, never an in-flight promise, timer, or request-owned counter. */
export function createWorkerPublicCache<T>({
  ttlMs,
  staleIfErrorMs,
  maxEntries,
  now = Date.now,
}: Options) {
  if (
    !Number.isFinite(ttlMs) ||
    ttlMs <= 0 ||
    !Number.isFinite(staleIfErrorMs) ||
    staleIfErrorMs < 0 ||
    !Number.isInteger(maxEntries) ||
    maxEntries < 1
  )
    throw new Error("Invalid public cache capacity or freshness.");
  const entries = new Map<string, Entry<T>>();
  const remember = (key: string, entry: Entry<T>) => {
    entries.delete(key);
    while (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
    entries.set(key, entry);
  };
  return {
    async get(key: string, load: () => Promise<T>): Promise<T> {
      const previous = entries.get(key);
      if (previous && previous.expiresAt > now()) {
        remember(key, previous);
        return previous.value;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Public data request timed out.")), 15_000);
        });
        const value = await Promise.race([Promise.resolve().then(load), deadline]);
        const current = entries.get(key);
        if (current && current !== previous && current.expiresAt > now()) return current.value;
        remember(key, { value, expiresAt: now() + ttlMs });
        return value;
      } catch (error) {
        const current = entries.get(key);
        if (current && now() < current.expiresAt + staleIfErrorMs) return current.value;
        if (current && current.expiresAt <= now()) entries.delete(key);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
