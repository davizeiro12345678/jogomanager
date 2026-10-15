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
  hasAthleteLocalDeletion,
  hasQueuedAthleteSync,
  hydrateAthlete,
  isAthleteSlot,
  listAthleteSyncQueue,
  listAthletes,
  queueAthleteDelete,
  queueAthleteSave,
  readAthlete,
  readAthleteEnvelope,
  readAthleteCloudRevision,
  recordAthleteCloudRevision,
  writeAthlete,
} from "@/lib/player-career-store";
import {
  deleteAthleteCloud,
  loadAthletesCloud,
  saveAthleteCloud,
} from "@/lib/player-career.functions";

const ATHLETE_SYNC_POLL_MS = 30_000;
const ATHLETE_SYNC_DEBOUNCE_MS = 1_500;

type AthleteFlushResult = { pending: boolean; failed: boolean; conflict: boolean };
const pendingFlushes = new Map<string, Promise<AthleteFlushResult>>();

/** Serialize flushes for each signed-in account; failed entries remain in the durable outbox. */
function flushAthleteSync(owner: string): Promise<AthleteFlushResult> {
  const inFlight = pendingFlushes.get(owner);
  if (inFlight) return inFlight;

  const flush = (async (): Promise<AthleteFlushResult> => {
    if (!athleteIsOnline()) {
      return {
        pending: listAthleteSyncQueue(owner).entries.length > 0,
        failed: false,
        conflict: false,
      };
    }
    let failed = false;
    let conflict = false;
    let remoteSnapshot: Awaited<ReturnType<typeof loadAthletesCloud>> | null = null;
    for (const entry of dueQueuedAthleteSync(owner)) {
      try {
        let expectedRevision = readAthleteCloudRevision(entry.slot, owner);
        if (expectedRevision === null) {
          // A queue created offline cannot assume that a pre-existing cloud slot is its parent.
          remoteSnapshot ??= await loadAthletesCloud();
          if (remoteSnapshot.some((row) => row.slot === entry.slot)) {
            failed = true;
            conflict = true;
            deferQueuedAthleteSync(entry.operationId, owner);
            continue;
          }
          if (!recordAthleteCloudRevision(entry.slot, 0, owner)) {
            throw new Error("Unable to persist cloud baseline");
          }
          expectedRevision = 0;
        }

        const result =
          entry.operation === "save"
            ? await saveAthleteCloud({
                data: {
                  slot: entry.slot,
                  state: entry.state!,
                  expectedRevision,
                },
              })
            : await deleteAthleteCloud({
                data: { slot: entry.slot, expectedRevision },
              });

        if (result.status === "conflict") {
          conflict = true;
          failed = true;
          deferQueuedAthleteSync(entry.operationId, owner);
          continue;
        }
        if (!recordAthleteCloudRevision(entry.slot, result.revision, owner)) {
          throw new Error("Unable to persist cloud acknowledgement");
        }
        acknowledgeQueuedAthleteSync(entry.operationId, owner);
      } catch {
        deferQueuedAthleteSync(entry.operationId, owner);
        failed = true;
      }
    }
    return {
      pending: listAthleteSyncQueue(owner).entries.length > 0,
      failed,
      conflict,
    };
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
          if (!isAthleteSlot(row.slot)) continue;
          remoteSlots.add(row.slot);
          const local = readAthlete(row.slot, userId);
          const pending = hasQueuedAthleteSync(row.slot, userId);
          const locallyDeleted = hasAthleteLocalDeletion(row.slot, userId);
          if (pending) {
            // Never update the CAS baseline while a local offline mutation is waiting.
            if (readAthleteCloudRevision(row.slot, userId) === null) {
              setError(
                "Há uma carreira offline pendente e outra versão na nuvem. O progresso local foi preservado; resolva o conflito antes de sincronizar.",
              );
            }
            continue;
          }
          if (row.deleted) {
            if (local || locallyDeleted) {
              setError(
                "Carreira excluída na nuvem. O arquivo local não foi alterado automaticamente.",
              );
            } else {
              recordAthleteCloudRevision(row.slot, row.revision, userId);
            }
            continue;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(row.state);
          } catch {
            setError("Um save da nuvem está inválido; a cópia local foi preservada.");
            continue;
          }
          const cloud = hydrateAthlete(parsed);
          if (!cloud || cloud.slot !== row.slot) {
            setError("Um save da nuvem está inválido; a cópia local foi preservada.");
            continue;
          }
          if (!local && !locallyDeleted) {
            const persisted = writeAthlete(cloud, userId);
            if (!persisted) {
              setError("Não foi possível gravar uma cópia local do atleta da nuvem.");
              continue;
            }
            recordAthleteCloudRevision(row.slot, row.revision, userId);
          } else if (local && JSON.stringify(local) === JSON.stringify(cloud)) {
            recordAthleteCloudRevision(row.slot, row.revision, userId);
          } else {
            setError(
              "A carreira local e a versão da nuvem são diferentes. Nenhuma delas foi sobrescrita. Exporte a cópia local antes de resolver o conflito.",
            );
          }
        }

        for (const slot of ATHLETE_SLOTS) {
          if (remoteSlots.has(slot) || hasQueuedAthleteSync(slot, userId)) continue;
          const existingRevision = readAthleteCloudRevision(slot, userId);
          if (existingRevision !== null && existingRevision !== 0) {
            setError("Um slot já sincronizado desapareceu da nuvem. A cópia local foi preservada.");
            continue;
          }
          const envelope = readAthleteEnvelope(slot, userId);
          if (!recordAthleteCloudRevision(slot, 0, userId)) continue;
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
        conflict: false,
      }));
      if (currentUser.current === removeUser && (result.pending || result.failed)) {
        setError(
          result.conflict
            ? "A exclusão encontrou um conflito na nuvem. A cópia local foi preservada como exclusão pendente."
            : "A remoção será repetida quando a conexão com a nuvem voltar.",
        );
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
  const [syncConflict, setSyncConflict] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSyncError(false);
    setSyncConflict(false);
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
          if (!disposed && currentUser.current === userId) setSyncConflict(result.conflict);
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
      setSyncConflict(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (currentUser.current !== commitUser) return;
        void flushAthleteSync(commitUser)
          .then((result) => {
            if (currentUser.current === commitUser) {
              setSyncError(result.pending || result.failed);
              setSyncConflict(result.conflict);
            }
          })
          .catch(() => {
            if (currentUser.current === commitUser) setSyncError(true);
          });
      }, ATHLETE_SYNC_DEBOUNCE_MS);
    },
    [owner, userId],
  );

  return { state, commit, syncError, syncConflict, signedIn: !!userId };
}
