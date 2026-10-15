import { useCallback, useEffect, useRef, useState } from "react";

import type { PlayerCareerState } from "@/game/player-career/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import {
  ATHLETE_SLOTS,
  acknowledgeQueuedAthleteSync,
  athleteIsOnline,
  deferQueuedAthleteSync,
  deleteAthlete,
  dueQueuedAthleteSync,
  hasQueuedAthleteSync,
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

const ATHLETE_SYNC_POLL_MS = 30_000;
const ATHLETE_SYNC_DEBOUNCE_MS = 1_500;

type AthleteFlushResult = { pending: boolean; failed: boolean };
const pendingFlushes = new Map<string, Promise<AthleteFlushResult>>();

/** Serialize flushes for each signed-in account; failed entries remain in the durable outbox. */
function flushAthleteSync(owner: string): Promise<AthleteFlushResult> {
  const inFlight = pendingFlushes.get(owner);
  if (inFlight) return inFlight;

  const flush = (async (): Promise<AthleteFlushResult> => {
    if (!athleteIsOnline()) {
      return { pending: listAthleteSyncQueue(owner).entries.length > 0, failed: false };
    }
    let failed = false;
    for (const entry of dueQueuedAthleteSync(owner)) {
      try {
        if (entry.operation === "save") {
          if (!entry.state) throw new Error("Missing athlete save state");
          await saveAthleteCloud({ data: { slot: entry.slot, state: entry.state } });
        } else {
          await deleteAthleteCloud({ data: { slot: entry.slot } });
        }
        acknowledgeQueuedAthleteSync(entry.operationId, owner);
      } catch {
        deferQueuedAthleteSync(entry.operationId, owner);
        failed = true;
      }
    }
    return { pending: listAthleteSyncQueue(owner).entries.length > 0, failed };
  })();

  pendingFlushes.set(owner, flush);
  void flush.finally(() => pendingFlushes.delete(owner));
  return flush;
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

    void loadAthletesCloud()
      .then((rows) => {
        if (disposed || epoch.current !== currentEpoch || currentUser.current !== userId) return;
        const remoteSlots = new Set<(typeof ATHLETE_SLOTS)[number]>();

        for (const row of rows) {
          const cloud = JSON.parse(row.state) as PlayerCareerState;
          if (!isAthleteSlot(row.slot)) continue;
          remoteSlots.add(row.slot);
          const local = readAthlete(row.slot, userId);
          if (cloud?.version === 1 && (!local || cloud.updatedAt > local.updatedAt)) {
            writeAthlete({ ...cloud, slot: row.slot }, userId);
          }
        }

        // A local account save missing from the response is also queued, never silently discarded.
        for (const slot of ATHLETE_SLOTS) {
          if (remoteSlots.has(slot) || hasQueuedAthleteSync(slot, userId)) continue;
          const envelope = readAthleteEnvelope(slot, userId);
          if (envelope) void queueAthleteSave(envelope, userId);
        }
        refresh(userId);
        void flushAthleteSync(userId);
      })
      .catch(() => {
        if (!disposed && currentUser.current === userId) {
          setError(
            "Não foi possível buscar seus atletas na nuvem. Os salvos no aparelho continuam disponíveis.",
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, [userId, owner, refresh]);

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
