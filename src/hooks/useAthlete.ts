import { useCallback, useEffect, useRef, useState } from "react";

import type { PlayerCareerState } from "@/game/player-career/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import {
  ATHLETE_SLOTS,
  acknowledgeQueuedAthleteSync,
  athleteIsOnline,
  athleteSyncScope,
  deferQueuedAthleteSync,
  deleteAthlete,
  dueQueuedAthleteSync,
  hasQueuedAthleteSync,
  hydrateAthlete,
  isAthleteSlot,
  listAthleteSyncQueue,
  listAthletes,
  queueAthleteDelete,
  queueAthleteSave,
  readAthlete,
  readAthleteEnvelope,
  writeAthlete,
} from "@/lib/player-career-store";
import {
  deleteAthleteCloud,
  loadAthletesCloud,
  saveAthleteCloud,
} from "@/lib/player-career.functions";

const ATHLETE_SYNC_DEBOUNCE_MS = 1_500;
const ATHLETE_SYNC_POLL_MS = 15_000;

interface AthleteSyncFlushResult {
  pending: boolean;
  failed: boolean;
}

/** One flush per account compartment prevents a save/delete race between the two hooks. */
const activeAthleteFlushes = new Map<string, Promise<AthleteSyncFlushResult>>();

async function runAthleteSync(owner: string): Promise<AthleteSyncFlushResult> {
  const before = listAthleteSyncQueue(owner);
  if (!before.entries.length) return { pending: false, failed: false };
  if (!athleteIsOnline()) return { pending: true, failed: true };

  const due = dueQueuedAthleteSync(owner);
  if (!due.length) return { pending: true, failed: false };

  for (const entry of due) {
    try {
      if (entry.operation === "save") {
        if (!entry.state) throw new Error("Save local pendente inválido.");
        await saveAthleteCloud({ data: { slot: entry.slot, state: entry.state as never } });
      } else {
        await deleteAthleteCloud({ data: { slot: entry.slot } });
      }
      // The remove is guarded by operationId, so an old response cannot drop a newer write.
      if (!acknowledgeQueuedAthleteSync(entry.operationId, owner))
        return { pending: true, failed: true };
    } catch {
      // Preserve the entry and serialize retries. A failure does not skip ahead of older work.
      void deferQueuedAthleteSync(entry.operationId, owner);
      return { pending: true, failed: true };
    }
  }

  return { pending: listAthleteSyncQueue(owner).entries.length > 0, failed: false };
}

function flushAthleteSync(owner: string) {
  const scope = athleteSyncScope(owner);
  const active = activeAthleteFlushes.get(scope);
  if (active) return active;

  const task = runAthleteSync(owner);
  activeAthleteFlushes.set(scope, task);
  return task.finally(() => {
    if (activeAthleteFlushes.get(scope) === task) activeAthleteFlushes.delete(scope);
  });
}

function parseCloudAthlete(value: string, slot: 1 | 2 | 3) {
  try {
    const state = hydrateAthlete(JSON.parse(value));
    return state ? { ...state, slot } : null;
  } catch {
    return null;
  }
}

/** Lista os 3 espaços de atleta. A nuvem só substitui o local se for mais nova. */
export function useAthleteSlots() {
  const userId = useAuthUserId();
  const owner = userId ?? null;
  const currentUser = useRef<string | null | undefined>(userId);
  currentUser.current = userId;
  const epoch = useRef(0);
  const [slots, setSlots] = useState<(PlayerCareerState | null)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    (requestedOwner = owner) => {
      if (currentUser.current === requestedOwner) setSlots(listAthletes(requestedOwner));
    },
    [owner],
  );

  useEffect(() => {
    const currentEpoch = ++epoch.current;
    let disposed = false;
    setError(null);
    if (userId === undefined) {
      setSlots(null);
      return;
    }

    refresh(owner);
    if (!userId) return;

    const syncPending = () => {
      void flushAthleteSync(userId)
        .then((result) => {
          if (!disposed && currentUser.current === userId && result.failed) {
            setError(
              "A nuvem está indisponível. As alterações continuam guardadas neste aparelho e serão reenviadas.",
            );
          }
        })
        .catch(() => {
          if (!disposed && currentUser.current === userId) {
            setError(
              "A nuvem está indisponível. As alterações continuam guardadas neste aparelho e serão reenviadas.",
            );
          }
        });
    };

    void loadAthletesCloud()
      .then((rows) => {
        if (disposed || epoch.current !== currentEpoch || currentUser.current !== userId) return;
        const remoteSlots = new Set<(typeof ATHLETE_SLOTS)[number]>();

        for (const row of rows) {
          if (!isAthleteSlot(row.slot)) continue;
          if (hasQueuedAthleteSync(row.slot, userId)) continue;
          const cloud = parseCloudAthlete(row.state, row.slot);
          if (!cloud) continue;
          remoteSlots.add(row.slot);

          const local = readAthlete(row.slot, userId);
          if (!local || cloud.updatedAt > local.updatedAt) {
            writeAthlete(cloud, userId);
          } else if (local.updatedAt > cloud.updatedAt) {
            const envelope = readAthleteEnvelope(row.slot, userId);
            if (envelope) void queueAthleteSave(envelope, userId);
          }
        }

        // A local account save missing from the response is also queued, never silently discarded.
        for (const slot of ATHLETE_SLOTS) {
          if (remoteSlots.has(slot) || hasQueuedAthleteSync(slot, userId)) continue;
          const envelope = readAthleteEnvelope(slot, userId);
          if (envelope) void queueAthleteSave(envelope, userId);
        }
        refresh(userId);
      })
      .catch(() => {
        if (!disposed && epoch.current === currentEpoch && currentUser.current === userId) {
          setError(
            "Não foi possível buscar seus atletas na nuvem. Os salvos neste aparelho continuam disponíveis.",
          );
        }
      })
      .finally(() => {
        if (!disposed && currentUser.current === userId) syncPending();
      });

    window.addEventListener("online", syncPending);
    const retryTimer = window.setInterval(syncPending, ATHLETE_SYNC_POLL_MS);
    return () => {
      disposed = true;
      window.removeEventListener("online", syncPending);
      window.clearInterval(retryTimer);
    };
  }, [owner, refresh, userId]);

  const remove = useCallback(
    async (slot: number) => {
      if (userId === undefined) return;
      const removeOwner = owner;
      const removeUser = userId;
      const tombstone = deleteAthlete(slot, removeOwner);
      refresh(removeOwner);
      if (!removeUser) return;
      if (!tombstone || !queueAthleteDelete(tombstone, removeUser)) {
        if (currentUser.current === removeUser) {
          setError(
            "Não foi possível registrar a remoção para sincronização. A cópia local foi atualizada.",
          );
        }
        return;
      }

      const result = await flushAthleteSync(removeUser).catch(() => ({
        pending: true,
        failed: true,
      }));
      if (currentUser.current === removeUser && (result.pending || result.failed)) {
        setError("A remoção será repetida quando a conexão com a nuvem voltar.");
      }
    },
    [owner, refresh, userId],
  );

  return { slots, error, remove, signedIn: !!userId };
}

export function useAthlete(slot: number) {
  const userId = useAuthUserId();
  const owner = userId ?? null;
  const currentUser = useRef<string | null | undefined>(userId);
  currentUser.current = userId;
  const [state, setState] = useState<PlayerCareerState | null | undefined>(undefined);
  const [syncError, setSyncError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSyncError(false);
    if (userId === undefined) {
      setState(undefined);
      return;
    }
    setState(readAthlete(slot, owner));
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [owner, slot, userId]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    const syncPending = () => {
      void flushAthleteSync(userId)
        .then((result) => {
          if (!disposed && currentUser.current === userId)
            setSyncError(result.pending || result.failed);
        })
        .catch(() => {
          if (!disposed && currentUser.current === userId) setSyncError(true);
        });
    };
    syncPending();
    window.addEventListener("online", syncPending);
    const retryTimer = window.setInterval(syncPending, ATHLETE_SYNC_POLL_MS);
    return () => {
      disposed = true;
      window.removeEventListener("online", syncPending);
      window.clearInterval(retryTimer);
    };
  }, [userId]);

  const commit = useCallback(
    (next: PlayerCareerState) => {
      if (userId === undefined) return;
      const commitOwner = owner;
      const commitUser = userId;
      const envelope = writeAthlete(next, commitOwner);
      setState(envelope?.state ?? next);
      if (!commitUser) return;
      if (!envelope || !queueAthleteSave(envelope, commitUser)) {
        setSyncError(true);
        return;
      }

      setSyncError(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (currentUser.current !== commitUser) return;
        void flushAthleteSync(commitUser)
          .then((result) => {
            if (currentUser.current === commitUser) setSyncError(result.pending || result.failed);
          })
          .catch(() => {
            if (currentUser.current === commitUser) setSyncError(true);
          });
      }, ATHLETE_SYNC_DEBOUNCE_MS);
    },
    [owner, userId],
  );

  return { state, commit, syncError, signedIn: !!userId };
}
