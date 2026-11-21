export interface RetainedCareerSave {
  isCurrent: () => boolean;
  localSettled: () => void;
  release: () => void;
}

const localWrites = new Map<string, Set<Promise<void>>>();
const writeRevisions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();
const compartment = (owner: string | null, epoch: number) => JSON.stringify([owner, epoch]);

export function careerLocalWriteRevision(owner: string | null, epoch: number | null): number {
  return epoch === null ? 0 : (writeRevisions.get(compartment(owner, epoch)) ?? 0);
}

export function hasCareerLocalWrites(owner: string | null, epoch: number | null): boolean {
  return epoch !== null && localWrites.has(compartment(owner, epoch));
}

/** Stable primitive snapshot for useSyncExternalStore, including a settled-write revision. */
export function careerLocalWriteSnapshot(owner: string | null, epoch: number | null): string {
  return `${careerLocalWriteRevision(owner, epoch)}:${hasCareerLocalWrites(owner, epoch) ? 1 : 0}`;
}

export function subscribeCareerLocalWrites(
  owner: string | null,
  epoch: number | null,
  onChange: () => void,
): () => void {
  if (epoch === null) return () => {};
  const key = compartment(owner, epoch);
  const subscribers = listeners.get(key) ?? new Set<() => void>();
  subscribers.add(onChange);
  listeners.set(key, subscribers);
  return () => {
    subscribers.delete(onChange);
    if (!subscribers.size) listeners.delete(key);
  };
}

function notifyLocalWrites(key: string) {
  for (const onChange of listeners.get(key) ?? []) onChange();
}

/** A remounted page must not hydrate from the middle of an accepted local save. */
export async function waitForCareerLocalWrites(owner: string | null, epoch: number): Promise<void> {
  const key = compartment(owner, epoch);
  while (localWrites.has(key)) await Promise.all([...localWrites.get(key)!]);
}

/**
 * Persistence outlives route navigation. Auth changes and career resets still
 * revoke it permanently; a return to the previous account cannot revive it.
 */
export function retainCareerSave({
  owner,
  epoch,
  readEpoch,
  observeOwner,
}: {
  owner: string | null;
  epoch: number;
  readEpoch: () => number | null;
  observeOwner: (observe: (owner: string | null) => void) => () => void;
}): RetainedCareerSave {
  let active = true;
  let released = false;
  let settled = false;
  let resolveLocal!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolveLocal = resolve;
  });
  const key = compartment(owner, epoch);
  const writes = localWrites.get(key) ?? new Set<Promise<void>>();
  writes.add(promise);
  localWrites.set(key, writes);
  writeRevisions.set(key, (writeRevisions.get(key) ?? 0) + 1);
  notifyLocalWrites(key);
  const localSettled = () => {
    if (settled) return;
    settled = true;
    writes.delete(promise);
    if (writes.size === 0) localWrites.delete(key);
    resolveLocal();
    notifyLocalWrites(key);
  };
  let unsubscribe: () => void;
  try {
    unsubscribe = observeOwner((currentOwner) => {
      if (currentOwner !== owner) active = false;
    });
  } catch (error) {
    localSettled();
    throw error;
  }
  return {
    isCurrent: () => {
      if (readEpoch() !== epoch) active = false;
      return active;
    },
    localSettled,
    release: () => {
      if (released) return;
      released = true;
      active = false;
      localSettled();
      unsubscribe();
    },
  };
}
