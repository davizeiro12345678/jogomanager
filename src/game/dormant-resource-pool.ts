export interface DormantResource<T> {
  value: T;
  estimatedBytes: number;
  dispose: () => void;
}

export interface DormantResourceLease<T> {
  readonly value: T;
  release: () => void;
}

type Entry<K, T> = DormantResource<T> & { key: K; idleSince: number; disposed: boolean };

/**
 * Exclusive resources can be reused only after their owner releases them.
 * Acquire from a committed lifecycle, never a React render/useMemo initializer:
 * speculative renders cannot guarantee cleanup of a discarded lease.
 * Callers must key every geometry/material input and detach before release.
 */
export function createDormantResourcePool<K, T>({
  maxDormantEntries = 12,
  maxDormantBytes = 16 * 1024 * 1024,
  maxIdleCycles = 2,
  onDisposeError,
}: {
  maxDormantEntries?: number;
  maxDormantBytes?: number;
  maxIdleCycles?: number;
  onDisposeError?: (error: unknown) => void;
} = {}) {
  if (
    ![maxDormantEntries, maxDormantBytes, maxIdleCycles].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    )
  )
    throw new Error("Invalid dormant resource pool budget.");
  const dormant = new Set<Entry<K, T>>();
  const byKey = new Map<K, Set<Entry<K, T>>>();
  let cycle = 0;
  let dormantBytes = 0;
  let activeLeases = 0;
  let created = 0;
  let reused = 0;
  let disposed = 0;
  let closed = false;

  function remove(entry: Entry<K, T>) {
    if (!dormant.delete(entry)) return;
    dormantBytes -= entry.estimatedBytes;
    const entries = byKey.get(entry.key);
    entries?.delete(entry);
    if (entries?.size === 0) byKey.delete(entry.key);
  }

  function destroy(entry: Entry<K, T>) {
    if (entry.disposed) return;
    entry.disposed = true;
    disposed++;
    try {
      entry.dispose();
    } catch (error) {
      try {
        onDisposeError?.(error);
      } catch {
        /* Keep disposing the other owned resources. */
      }
    }
  }

  function prune() {
    for (const entry of dormant) {
      if (
        cycle - entry.idleSince > maxIdleCycles ||
        dormant.size > maxDormantEntries ||
        dormantBytes > maxDormantBytes
      ) {
        remove(entry);
        destroy(entry);
      }
    }
  }

  return {
    get stats() {
      return {
        activeLeases,
        dormantEntries: dormant.size,
        dormantBytes,
        cycle,
        created,
        reused,
        disposed,
      };
    },
    acquire(key: K, factory: () => DormantResource<T>): DormantResourceLease<T> {
      if (closed) throw new Error("Dormant resource pool is closed.");
      let entry = byKey.get(key)?.values().next().value;
      if (entry) {
        remove(entry);
        reused++;
      } else {
        const resource = factory();
        entry = { ...resource, key, idleSince: cycle, disposed: false };
        if (!Number.isSafeInteger(resource.estimatedBytes) || resource.estimatedBytes < 0) {
          destroy(entry);
          throw new Error("Invalid dormant resource size.");
        }
        created++;
      }
      activeLeases++;
      let released = false;
      const held = entry;
      return {
        value: held.value,
        release: () => {
          if (released) return;
          released = true;
          activeLeases--;
          if (closed || held.estimatedBytes > maxDormantBytes || maxDormantEntries === 0) {
            destroy(held);
            return;
          }
          held.idleSince = cycle;
          dormant.add(held);
          dormantBytes += held.estimatedBytes;
          const entries = byKey.get(key) ?? new Set<Entry<K, T>>();
          entries.add(held);
          byKey.set(key, entries);
          prune();
        },
      };
    },
    advanceCycle() {
      if (closed) return;
      cycle++;
      prune();
    },
    dispose() {
      if (closed) return;
      closed = true;
      for (const entry of dormant) {
        remove(entry);
        destroy(entry);
      }
    },
  };
}
