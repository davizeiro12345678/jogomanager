import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { migrateCareer } from "@/game/career-migration";
import { recordWorldTransition, withCareerWorld } from "@/game/career-world";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { createCareer, deleteCareer, loadCareer, saveCareer } from "@/lib/career.functions";
import { resetCareerSafely, type CareerResetOutcome } from "@/lib/career-reset";
import {
  canMutateCareer,
  canResetCareer,
  resolveCareerHydrationBarrier,
  resolveCareerHydrationStatus,
  type CareerHydrationStatus,
} from "@/lib/career-hydration";
import {
  acknowledgeOutbox,
  clearLocalCareerTombstone,
  clearLocalCareerSyncBlock,
  clearLocalCareer,
  isOnline,
  isVersionedOutboxEntry,
  loadLocalCareer,
  localSavedAt,
  markLocalCareerSyncBlock,
  markCareerReset,
  markLocalCareerTombstone,
  queueSync,
  readCareerEpoch,
  readLocalCareerGeneration,
  readLocalCareerSyncBlock,
  readLocalCareerTombstone,
  readOutbox,
  saveLocalCareer,
  setLocalCareerGeneration,
  withCareerLock,
  type LocalOwnerId,
} from "@/lib/offline/store";
import type { CareerState } from "@/game/types";
import type { CareerTombstone } from "@/lib/career-lifecycle.server";

export const CAREER_KEY = ["career"] as const;

export { canMutateCareer };

export type SyncState = "local" | "syncing" | "synced" | "pending" | "offline";
export type { CareerHydrationStatus };

type CareerQueryData = {
  career: CareerState | null;
  sync: SyncState;
  status: CareerHydrationStatus;
  generation: number | null;
  tombstone: CareerTombstone | null;
  epoch: number | null;
};

export function captureCareerMutationEpoch(
  previous: Pick<CareerQueryData, "epoch"> | undefined,
  currentEpoch: number | null,
): number | null {
  return previous === undefined ? currentEpoch : previous.epoch;
}

export type CareerMutationGate = {
  tryAcquire: (identityGeneration?: number) => boolean;
  release: (identityGeneration?: number) => void;
};

/**
 * Accepts at most one local career mutation until its persistence lifecycle
 * settles. This is intentionally synchronous: a second click must be rejected
 * before React Query can enqueue another mutation.
 */
export function createCareerMutationGate(): CareerMutationGate {
  let acquired = false;
  let acquiredGeneration: number | undefined;
  return {
    tryAcquire: (identityGeneration) => {
      if (acquired) return false;
      acquired = true;
      acquiredGeneration = identityGeneration;
      return true;
    },
    release: (identityGeneration) => {
      if (
        acquiredGeneration !== undefined &&
        identityGeneration !== undefined &&
        acquiredGeneration !== identityGeneration
      )
        return;
      acquired = false;
      acquiredGeneration = undefined;
    },
  };
}

export type CareerIdentityOwner = string | null | undefined;
export type CareerIdentityToken = { owner: CareerIdentityOwner; generation: number };

export type CareerIdentityTracker = {
  capture: () => CareerIdentityToken;
  switchTo: (owner: CareerIdentityOwner) => CareerIdentityToken;
  isCurrent: (token: CareerIdentityToken) => boolean;
  invalidate: () => void;
};

/**
 * A user id is not a session identity: A→B→A must still invalidate A's first
 * callbacks. The hook uses the same monotonic rule for every async boundary.
 */
export function createCareerIdentityTracker(
  initialOwner: CareerIdentityOwner,
): CareerIdentityTracker {
  let current: CareerIdentityToken = { owner: initialOwner, generation: 0 };
  return {
    capture: () => current,
    switchTo: (owner) => {
      if (current.owner !== owner) current = { owner, generation: current.generation + 1 };
      return current;
    },
    isCurrent: (token) => token.owner === current.owner && token.generation === current.generation,
    invalidate: () => {
      current = { owner: current.owner, generation: current.generation + 1 };
    },
  };
}

export function careerQueryKey(scope: string, identityGeneration: number) {
  return [...CAREER_KEY, scope, identityGeneration] as const;
}

/** Do not publish an authenticated optimistic state before its local barrier is confirmed. */
export async function publishCareerAfterPersistence(
  persist: () => Promise<boolean>,
  publishReady: () => void,
): Promise<boolean> {
  if (!(await persist())) return false;
  publishReady();
  return true;
}

type CareerMutationInput = {
  state: CareerState;
  previous: CareerQueryData | undefined;
  owner: LocalOwnerId;
  userId: string | null | undefined;
  scope: string;
  identityGeneration: number;
  epoch: number | null;
};

type CareerHydrationInput = {
  userId: string | null | undefined;
  isPending: boolean;
  hasError: boolean;
  data?:
    | {
        career: unknown;
        sync: SyncState;
        status?: CareerHydrationStatus;
        tombstone?: CareerTombstone | null;
        hydration?: Exclude<CareerHydrationStatus, "loading">;
      }
    | undefined;
};

export function deriveCareerHydrationStatus({
  userId,
  isPending,
  hasError,
  data,
}: CareerHydrationInput): CareerHydrationStatus {
  if (userId === undefined || isPending || (!data && !hasError)) return "loading";
  if (hasError || data?.hydration === "error" || data?.status === "error") return "error";
  if (data?.hydration === "offline" || data?.status === "offline" || data?.sync === "offline")
    return "offline";
  if (data?.tombstone) return "tombstoned";
  if (data?.status && data.status !== "loading") return data.status;
  return data?.career ? "ready" : "empty";
}

/** Tracks whether a Supabase session exists. `null` while unknown. */
export function useSignedIn() {
  const userId = useAuthUserId();
  return userId === undefined ? null : userId !== null;
}

/**
 * Persistência da carreira que funciona com ou sem conta e com ou sem internet.
 *
 * Each account gets a distinct query, local save, snapshot and outbox. A guest
 * save is deliberately not imported into an authenticated account: ownership
 * has to be confirmed by an explicit import flow, never inferred from a shared
 * browser profile.
 */
export function useCareer() {
  const qc = useQueryClient();
  const userId = useAuthUserId();
  const signedIn = userId === undefined ? null : userId !== null;
  const owner: LocalOwnerId = userId ?? null;
  const scope = userId ?? "guest";
  const tombstoneRef = useRef<CareerTombstone | null>(null);
  const tombstoneScope = useRef(scope);
  const flushingScope = useRef<{ scope: string; identityGeneration: number } | null>(null);
  const resetting = useRef(false);
  const activeSaveCount = useRef(0);
  const mutationGate = useRef(createCareerMutationGate());
  const mountedRef = useRef(true);
  const identityTrackerRef = useRef(createCareerIdentityTracker(userId));
  const identityTracker = identityTrackerRef.current;
  const previousIdentityToken = identityTracker.capture();
  const identityToken = identityTracker.switchTo(userId);
  if (previousIdentityToken.generation !== identityToken.generation) {
    tombstoneRef.current = null;
    tombstoneScope.current = scope;
    flushingScope.current = null;
    resetting.current = false;
    activeSaveCount.current = 0;
    mutationGate.current = createCareerMutationGate();
  }
  if (tombstoneScope.current !== scope) {
    tombstoneScope.current = scope;
    tombstoneRef.current = null;
  }
  const identityGeneration = identityToken.generation;
  const currentOwner = useRef<string | null | undefined>(userId);
  // Updating the ref during render closes the small gap before effects run when
  // a sign-in/sign-out swaps the active account.
  currentOwner.current = userId;
  const isCurrentOwner = useCallback(
    (candidate: LocalOwnerId, candidateGeneration?: number) =>
      currentOwner.current !== undefined &&
      currentOwner.current === candidate &&
      (candidateGeneration === undefined ||
        identityTracker.isCurrent({
          owner: candidate,
          generation: candidateGeneration,
        })),
    [identityTracker],
  );
  const isCurrentOperation = useCallback(
    (candidate: LocalOwnerId, candidateGeneration: number) =>
      mountedRef.current && isCurrentOwner(candidate, candidateGeneration),
    [isCurrentOwner],
  );

  const load = useServerFn(loadCareer);
  const save = useServerFn(saveCareer);
  const createRemote = useServerFn(createCareer);
  const wipe = useServerFn(deleteCareer);
  const [sync, setSyncState] = useState<SyncState>("local");
  const syncRef = useRef<SyncState>("local");
  const setSync = useCallback((next: SyncState) => {
    syncRef.current = next;
    setSyncState(next);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      identityTracker.invalidate();
      activeSaveCount.current = 0;
      mutationGate.current = createCareerMutationGate();
      flushingScope.current = null;
      resetting.current = false;
    };
  }, [identityTracker]);

  const queryKey = careerQueryKey(scope, identityGeneration);

  const query = useQuery({
    queryKey,
    enabled: userId !== undefined,
    queryFn: async ({ signal }): Promise<CareerQueryData> => {
      const queryGeneration = identityGeneration;
      const queryEpoch = readCareerEpoch(owner);
      const isActive = () =>
        !signal.aborted &&
        queryEpoch !== null &&
        isCurrentOperation(owner, queryGeneration) &&
        readCareerEpoch(owner) === queryEpoch;
      const ensureActive = () => {
        if (!isActive()) throw new Error("stale career hydration operation");
      };
      const result = (
        career: CareerState | null,
        nextSync: SyncState,
        options: {
          online?: boolean;
          requestError?: boolean;
          generation?: number | null;
          tombstone?: CareerTombstone | null;
        } = {},
      ): CareerQueryData => ({
        career,
        sync: nextSync,
        generation: options.generation ?? null,
        tombstone: options.tombstone ?? null,
        epoch: queryEpoch,
        status: resolveCareerHydrationStatus({
          phase: "loaded",
          hasCareer: career !== null,
          signedIn: Boolean(userId),
          online: options.online ?? isOnline(),
          requestError: options.requestError ?? false,
          tombstoned: !!options.tombstone,
        }),
      });
      if (queryEpoch === null) return result(null, "pending", { requestError: true });
      const local = await loadLocalCareer(owner);
      ensureActive();
      const localGeneration = await readLocalCareerGeneration(owner);
      ensureActive();
      const localTombstone = await readLocalCareerTombstone(owner);
      ensureActive();
      const localBlock = await readLocalCareerSyncBlock(owner);
      ensureActive();
      // Migration is in memory only: rewriting the save here would bump its
      // timestamp and let a stale local copy beat newer cloud progress.
      const repairLocal = (raw: CareerState) => migrateCareer(raw);
      if (!userId)
        return localTombstone
          ? result(null, "local", { tombstone: localTombstone })
          : result(local ? repairLocal(local) : null, "local");
      if (!isOnline()) {
        if (localTombstone) {
          ensureActive();
          tombstoneRef.current = localTombstone;
          return result(null, "offline", {
            online: false,
            tombstone: localTombstone,
            generation: localTombstone.generation,
          });
        }
        if (localBlock) {
          const blockedTombstone =
            localBlock.reason === "deleted" &&
            localBlock.generation !== null &&
            localBlock.deletedAt
              ? { generation: localBlock.generation, deletedAt: localBlock.deletedAt }
              : null;
          if (blockedTombstone) {
            ensureActive();
            tombstoneRef.current = blockedTombstone;
          }
          return result(null, "offline", {
            online: false,
            requestError: true,
            generation: localBlock.generation,
            tombstone: blockedTombstone,
          });
        }
        return result(local ? repairLocal(local) : null, "offline", {
          online: false,
          generation: localGeneration,
          requestError: localBlock !== null,
        });
      }
      ensureActive();
      const knownTombstone = localTombstone ?? tombstoneRef.current;
      if (knownTombstone) tombstoneRef.current = knownTombstone;

      // Online does not prove a blocked local save reached the cloud. Until a
      // dedicated reconciliation confirms it, retain the barrier and snapshot.
      // Deleted barriers are handled by tombstone logic above/below, not erased
      // merely because a remote career record exists.
      const hydrationBarrier = resolveCareerHydrationBarrier({
        localBlock,
        localCareer: local ? repairLocal(local) : null,
      });
      if (hydrationBarrier.blocked)
        return result(hydrationBarrier.career, hydrationBarrier.sync, {
          online: true,
          requestError: true,
          generation: localGeneration,
        });

      let cloud: CareerState | null = null;
      let cloudGeneration: number | null = null;
      try {
        const raw = await load();
        ensureActive();
        if (raw) {
          if (raw.deletedAt) {
            if (!Number.isSafeInteger(raw.generation) || raw.generation < 1)
              throw new Error("A carreira removida não confirmou sua geração.");
            const tombstone = {
              generation: raw.generation,
              deletedAt: raw.deletedAt,
            } satisfies CareerTombstone;
            if (knownTombstone && raw.generation < knownTombstone.generation)
              return result(null, "local", {
                tombstone: knownTombstone,
                generation: knownTombstone.generation,
                online: true,
                requestError: true,
              });
            ensureActive();
            tombstoneRef.current = tombstone;
            const tombstonePersisted = await markLocalCareerTombstone(tombstone, owner, {
              expectedEpoch: queryEpoch,
            });
            ensureActive();
            if (!tombstonePersisted) {
              // The cloud deletion is authoritative. Try verified removal of
              // every stale local copy, while retaining the in-session barrier.
              ensureActive();
              if (!(await clearLocalCareer(owner, { expectedEpoch: queryEpoch })))
                return result(null, "local", {
                  tombstone,
                  generation: tombstone.generation,
                  online: true,
                  requestError: true,
                });
              ensureActive();
            }
            return result(null, "local", {
              tombstone,
              generation: tombstone.generation,
              online: true,
            });
          }
          if (!Number.isSafeInteger(raw.generation) || raw.generation < 1 || !raw.state)
            throw new Error("A carreira remota não confirmou sua geração.");
          if (knownTombstone && raw.generation <= knownTombstone.generation)
            return result(null, "local", {
              tombstone: knownTombstone,
              generation: raw.generation,
              online: true,
              requestError: true,
            });
          if (localTombstone) {
            ensureActive();
            if (
              !(await clearLocalCareerTombstone(owner, {
                expectedEpoch: queryEpoch,
              }))
            )
              return result(null, "local", {
                tombstone: localTombstone,
                generation: raw.generation,
                online: true,
                requestError: true,
              });
            ensureActive();
          }
          ensureActive();
          if (
            !(await setLocalCareerGeneration(raw.generation, owner, {
              expectedEpoch: queryEpoch,
            }))
          )
            throw new Error("A nova geração da carreira não pôde ser persistida localmente.");
          ensureActive();
          if (
            !(await clearLocalCareerSyncBlock(owner, {
              expectedEpoch: queryEpoch,
            }))
          )
            throw new Error("A barreira local de sincronização não pôde ser removida.");
          ensureActive();
          tombstoneRef.current = null;
          cloud = raw.state as CareerState;
          cloudGeneration = raw.generation;
        }
      } catch (error) {
        if (!isActive()) throw error;
        const offline = !isOnline();
        if (knownTombstone) {
          ensureActive();
          tombstoneRef.current = knownTombstone;
          return result(null, offline ? "offline" : "local", {
            online: !offline,
            requestError: !offline,
            generation: knownTombstone.generation,
            tombstone: knownTombstone,
          });
        }
        return result(local ? repairLocal(local) : null, offline ? "offline" : "local", {
          online: !offline,
          requestError: !offline,
          generation: localGeneration,
        });
      }

      ensureActive();
      if (!cloud && knownTombstone) {
        tombstoneRef.current = knownTombstone;
        return result(null, "local", {
          online: true,
          requestError: true,
          generation: knownTombstone.generation,
          tombstone: knownTombstone,
        });
      }
      if (cloud) {
        const migrated = repairLocal(cloud);
        if (isActive() && cloudGeneration !== null) {
          const locallySaved =
            queryEpoch !== null &&
            (await saveLocalCareer(migrated, "nuvem", owner, {
              generation: cloudGeneration,
              expectedEpoch: queryEpoch,
            }));
          if (!locallySaved)
            return result(migrated, "pending", {
              requestError: true,
              generation: cloudGeneration,
            });
          ensureActive();
        }
        return result(migrated, "synced", { generation: cloudGeneration });
      }
      if (localBlock || local)
        return result(local ? repairLocal(local) : null, "local", {
          requestError: Boolean(local),
          generation: localGeneration,
        });
      return result(null, "local", { generation: localGeneration });
    },
    staleTime: 30_000,
    retry: false,
  });

  const hydrationStatus = deriveCareerHydrationStatus({
    userId,
    isPending: query.isPending || query.isLoading,
    hasError: !!query.error,
    data: query.data,
  });

  // Clear the previous account's status immediately. Query data is separately
  // keyed, but an old pending label must not appear during the identity switch.
  useEffect(() => {
    setSync("local");
  }, [scope, setSync]);

  // O estado de sincronização só é aplicado depois da montagem: alterá-lo
  // dentro do queryFn atualizava um componente ainda não montado.
  const querySync = query.data?.sync;
  useEffect(() => {
    if (querySync) setSync(querySync);
  }, [querySync, setSync]);

  const queryStatus = query.data?.status;
  const hasCareerSnapshot = query.data?.career !== null && query.data?.career !== undefined;
  const careerStatus: CareerHydrationStatus =
    userId === undefined || query.isPending || (query.isFetching && queryStatus !== "ready")
      ? "loading"
      : query.isError
        ? "error"
        : (queryStatus ?? hydrationStatus);
  const refetch = query.refetch;
  const retry = useCallback(() => {
    setSync("local");
    return refetch();
  }, [refetch, setSync]);

  const setSyncForOwner = useCallback(
    (candidate: LocalOwnerId, next: SyncState, candidateGeneration?: number) => {
      if (
        candidateGeneration === undefined
          ? isCurrentOwner(candidate)
          : isCurrentOperation(candidate, candidateGeneration)
      )
        setSync(next);
    },
    [isCurrentOperation, isCurrentOwner, setSync],
  );

  const handleSaveBarrier = useCallback(
    async (
      result: unknown,
      barrierOwner: LocalOwnerId,
      barrierGeneration: number,
      barrierEpoch?: number,
      lockHeld = false,
    ) => {
      if (!isCurrentOperation(barrierOwner, barrierGeneration)) return;
      if (!result || typeof result !== "object") return;
      const candidate = result as {
        deleted?: boolean;
        deletedAt?: string;
        generation?: number | null;
        conflict?: boolean;
        reason?: string;
      };
      const generation = candidate.generation;
      if (
        candidate.deleted &&
        candidate.deletedAt &&
        typeof generation === "number" &&
        Number.isSafeInteger(generation) &&
        generation > 0
      ) {
        const tombstone = { generation, deletedAt: candidate.deletedAt };
        if (!isCurrentOperation(barrierOwner, barrierGeneration)) return;
        tombstoneRef.current = tombstone;
        await markLocalCareerTombstone(tombstone, barrierOwner, {
          ...(lockHeld ? { lockHeld: true } : {}),
          ...(barrierEpoch !== undefined ? { expectedEpoch: barrierEpoch } : {}),
        });
        return;
      }
      if (candidate.conflict) {
        if (!isCurrentOperation(barrierOwner, barrierGeneration)) return;
        await markLocalCareerSyncBlock(
          {
            reason:
              candidate.reason === "legacy_outbox"
                ? "legacy_outbox"
                : candidate.reason === "unknown_generation"
                  ? "unknown_generation"
                  : "conflict",
            generation:
              typeof generation === "number" && Number.isSafeInteger(generation)
                ? generation
                : null,
            blockedAt: new Date().toISOString(),
          },
          barrierOwner,
          {
            ...(lockHeld ? { lockHeld: true } : {}),
            ...(barrierEpoch !== undefined ? { expectedEpoch: barrierEpoch } : {}),
          },
        );
      }
    },
    [isCurrentOperation],
  );

  const mutation = useMutation({
    mutationFn: async ({
      state,
      previous,
      owner: mutationOwner,
      userId: mutationUser,
      scope: mutationScope,
      identityGeneration: mutationGeneration,
      epoch: mutationEpoch,
    }: CareerMutationInput) => {
      const mutationKey = careerQueryKey(mutationScope, mutationGeneration);
      const isActive = () =>
        isCurrentOperation(mutationOwner, mutationGeneration) &&
        mutationEpoch !== null &&
        readCareerEpoch(mutationOwner) === mutationEpoch;
      const ensureActive = () => {
        if (!isActive()) return false;
        return true;
      };
      const current = previous ?? qc.getQueryData<CareerQueryData>(mutationKey);
      const observedGeneration =
        current?.generation ??
        (mutationUser ? await readLocalCareerGeneration(mutationOwner) : null);
      if (!ensureActive()) return { ok: true, stale: true };
      let readyPublished = false;
      const publishReady = () => {
        if (
          readyPublished ||
          !isActive() ||
          mutationEpoch === null ||
          readCareerEpoch(mutationOwner) !== mutationEpoch
        )
          return;
        readyPublished = true;
        qc.setQueryData<CareerQueryData>(mutationKey, (latest) => ({
          career: state,
          sync: latest?.sync ?? "pending",
          status: "ready",
          generation: latest?.generation ?? observedGeneration,
          tombstone: null,
          epoch: mutationEpoch,
        }));
      };
      const setPending = () => setSyncForOwner(mutationOwner, "pending", mutationGeneration);
      const persistLocally = async (lockHeld = false) => {
        if (mutationUser === undefined) return { ok: false, blocked: true };
        if (mutationEpoch === null || readCareerEpoch(mutationOwner) !== mutationEpoch)
          return { ok: false, blocked: true };
        if (mutationUser && observedGeneration === null) {
          if (!ensureActive()) return { ok: true, stale: true };
          const marked = await markLocalCareerSyncBlock(
            {
              reason: "unknown_generation",
              generation: null,
              blockedAt: new Date().toISOString(),
            },
            mutationOwner,
            {
              ...(lockHeld ? { lockHeld: true } : {}),
              expectedEpoch: mutationEpoch,
            },
          );
          if (!ensureActive()) return { ok: true, stale: true };
          if (marked) setPending();
          return { ok: false, blocked: true };
        }
        if (mutationUser) {
          if (!ensureActive()) return { ok: true, stale: true };
          const marked = await markLocalCareerSyncBlock(
            {
              reason: "pending_save",
              generation: observedGeneration,
              blockedAt: new Date().toISOString(),
            },
            mutationOwner,
            {
              ...(lockHeld ? { lockHeld: true } : {}),
              expectedEpoch: mutationEpoch,
            },
          );
          if (!ensureActive()) return { ok: true, stale: true };
          if (!marked) {
            setPending();
            return { ok: false, blocked: true };
          }
        }
        if (!ensureActive()) return { ok: true, stale: true };
        const localOptions = {
          ...(mutationUser && observedGeneration !== null
            ? { generation: observedGeneration }
            : {}),
          ...(lockHeld ? { lockHeld: true } : {}),
          allowPendingBarrier: Boolean(mutationUser),
          ...(mutationEpoch !== null ? { expectedEpoch: mutationEpoch } : {}),
        };
        const locallySaved = await saveLocalCareer(state, "auto", mutationOwner, localOptions);
        if (!ensureActive()) return { ok: true, stale: true };
        if (!mutationUser) {
          setSyncForOwner(mutationOwner, "local", mutationGeneration);
          return { ok: true };
        }
        if (observedGeneration === null) {
          setPending();
          return { ok: false, blocked: true };
        }
        if (!locallySaved) {
          if (!ensureActive()) return { ok: true, stale: true };
          const marked = await markLocalCareerSyncBlock(
            {
              reason: "pending_save",
              generation: observedGeneration,
              blockedAt: new Date().toISOString(),
            },
            mutationOwner,
            {
              ...(lockHeld ? { lockHeld: true } : {}),
              expectedEpoch: mutationEpoch,
            },
          );
          if (!ensureActive()) return { ok: true, stale: true };
          if (marked) setPending();
          return { ok: false, blocked: true };
        }
        if (!ensureActive()) return { ok: true, stale: true };
        // Keep the local save queued when this browser cannot coordinate a
        // remote write. Reset is then safely fail-closed instead of racing it.
        const pending = await queueSync(state, mutationOwner, {
          ...(lockHeld ? { lockHeld: true } : {}),
          generation: observedGeneration,
          allowPendingBarrier: true,
          ...(mutationEpoch !== null ? { expectedEpoch: mutationEpoch } : {}),
        });
        if (!ensureActive()) return { ok: true, stale: true };
        if (!pending) {
          if (!ensureActive()) return { ok: true, stale: true };
          const marked = await markLocalCareerSyncBlock(
            {
              reason: "pending_save",
              generation: observedGeneration,
              blockedAt: new Date().toISOString(),
            },
            mutationOwner,
            {
              ...(lockHeld ? { lockHeld: true } : {}),
              expectedEpoch: mutationEpoch,
            },
          );
          if (!ensureActive()) return { ok: true, stale: true };
          if (marked) setPending();
          return { ok: false, blocked: true };
        }
        if (!ensureActive()) return { ok: true, stale: true };
        // Snapshot and outbox are durable before this barrier is cleared. A
        // remote network error therefore keeps both recovery records and the
        // UI ready/pending; never roll back valid offline progress.
        const barrierCleared = await clearLocalCareerSyncBlock(mutationOwner, {
          ...(lockHeld ? { lockHeld: true } : {}),
          expectedEpoch: mutationEpoch,
        });
        if (!ensureActive()) return { ok: true, stale: true };
        if (!barrierCleared) {
          setPending();
          return { ok: false, blocked: true };
        }
        publishReady();
        setPending();
        return { ok: true, pending };
      };

      const upload = async (lockHeld: boolean) => {
        const local = await persistLocally(lockHeld);
        if (!ensureActive() || !local.ok || ("stale" in local && local.stale)) return local;
        if (!("pending" in local) || !local.pending) return { ok: false, blocked: true };
        const pending = local.pending;
        if (!isOnline()) {
          setSyncForOwner(mutationOwner, "pending", mutationGeneration);
          return { ok: true };
        }
        setSyncForOwner(mutationOwner, "syncing", mutationGeneration);
        try {
          const res = await save({
            data: { state, expectedOwnerId: mutationUser, expectedGeneration: observedGeneration },
          });
          if (!ensureActive()) return { ok: true, stale: true };
          if (!res.ok && !res.stale) {
            await handleSaveBarrier(
              res,
              mutationOwner,
              mutationGeneration,
              mutationEpoch ?? undefined,
              lockHeld,
            );
            if (!ensureActive()) return { ok: true, stale: true };
            setPending();
            void qc.invalidateQueries({ queryKey: mutationKey });
            return { ok: false, blocked: true };
          }
          const acknowledged = await acknowledgeOutbox(pending, mutationOwner, {
            lockHeld: true,
          });
          if (!ensureActive()) return { ok: true, stale: true };
          setSyncForOwner(mutationOwner, acknowledged ? "synced" : "pending", mutationGeneration);
          // The cloud has newer progress: reload it instead of keeping the old copy.
          if ("stale" in res && res.stale && ensureActive())
            void qc.invalidateQueries({ queryKey: mutationKey });
        } catch {
          // The durable local snapshot/outbox remain the source of recovery
          // after a remote network throw; only the sync label stays pending.
          if (ensureActive()) setPending();
        }
        return { ok: true };
      };

      if (!mutationUser) return persistLocally();
      const coordinated = await withCareerLock(
        mutationOwner,
        () => upload(true),
        mutationEpoch ?? undefined,
      );
      if (!ensureActive()) return { ok: true, stale: true };
      if (coordinated.acquired) return coordinated.value ?? { ok: true, stale: true };
      return upload(false);
    },
  });

  // Envia a fila assim que a conexão volta, sem deixar uma conta drenar a fila
  // persistida de outra durante uma troca de sessão.
  const flush = useCallback(async () => {
    const flushOwner = owner;
    const flushGeneration = identityGeneration;
    const flushKey = queryKey;
    const flushEpoch = readCareerEpoch(flushOwner);
    if (flushEpoch === null) return;
    const isActive = () =>
      isCurrentOperation(flushOwner, flushGeneration) && readCareerEpoch(flushOwner) === flushEpoch;
    if (
      resetting.current ||
      !userId ||
      flushingScope.current?.scope === scope ||
      !isOnline() ||
      !isActive()
    )
      return;
    flushingScope.current = { scope, identityGeneration: flushGeneration };
    try {
      const coordinated = await withCareerLock(
        flushOwner,
        async () => {
          if (!isActive()) return { kind: "stale" as const };
          const syncBlock = await readLocalCareerSyncBlock(flushOwner);
          if (!isActive()) return { kind: "stale" as const };
          if (syncBlock) {
            setSyncForOwner(flushOwner, "pending", flushGeneration);
            return { kind: "blocked" as const };
          }
          let entry;
          try {
            entry = await readOutbox(flushOwner);
          } catch {
            if (isActive()) setSyncForOwner(flushOwner, "pending", flushGeneration);
            return { kind: "blocked" as const };
          }
          if (!isActive()) return { kind: "stale" as const };
          if (!entry) return { kind: "empty" as const };
          if (!isVersionedOutboxEntry(entry)) {
            if (!isActive()) return { kind: "stale" as const };
            await markLocalCareerSyncBlock(
              {
                reason: "legacy_outbox",
                generation: null,
                blockedAt: new Date().toISOString(),
              },
              flushOwner,
              { lockHeld: true, expectedEpoch: flushEpoch },
            );
            if (!isActive()) return { kind: "stale" as const };
            setSyncForOwner(flushOwner, "pending", flushGeneration);
            return { kind: "blocked" as const };
          }
          const localGeneration = await readLocalCareerGeneration(flushOwner);
          if (!isActive()) return { kind: "stale" as const };
          if (localGeneration === null || localGeneration !== entry.generation) {
            if (!isActive()) return { kind: "stale" as const };
            await markLocalCareerSyncBlock(
              {
                reason: "conflict",
                generation: localGeneration,
                blockedAt: new Date().toISOString(),
              },
              flushOwner,
              { lockHeld: true, expectedEpoch: flushEpoch },
            );
            if (!isActive()) return { kind: "stale" as const };
            setSyncForOwner(flushOwner, "pending", flushGeneration);
            return { kind: "blocked" as const };
          }
          setSyncForOwner(flushOwner, "syncing", flushGeneration);
          try {
            const res = await save({
              data: {
                state: migrateCareer(entry.state),
                expectedOwnerId: userId,
                expectedGeneration: entry.generation,
              },
            });
            if (!isActive()) return { kind: "stale" as const };
            if (!res.ok && !res.stale) {
              await handleSaveBarrier(res, flushOwner, flushGeneration, flushEpoch, true);
              if (!isActive()) return { kind: "stale" as const };
              setSyncForOwner(flushOwner, "pending", flushGeneration);
              void qc.invalidateQueries({ queryKey: flushKey });
              return { kind: "blocked" as const };
            }
            const acknowledged = await acknowledgeOutbox(entry, flushOwner, {
              lockHeld: true,
              expectedEpoch: flushEpoch,
            });
            if (!isActive()) return { kind: "stale" as const };
            setSyncForOwner(flushOwner, acknowledged ? "synced" : "pending", flushGeneration);
            if ("stale" in res && res.stale && isActive())
              void qc.invalidateQueries({ queryKey: flushKey });
          } catch {
            if (isActive()) setSyncForOwner(flushOwner, "pending", flushGeneration);
          }
          return { kind: "flushed" as const };
        },
        flushEpoch,
      );
      // A stale lock result means a reset advanced this compartment's epoch;
      // do not resurrect a pending state after that reset has cleared storage.
      if (isActive() && !coordinated.acquired)
        setSyncForOwner(flushOwner, "pending", flushGeneration);
    } finally {
      if (
        flushingScope.current?.scope === scope &&
        flushingScope.current.identityGeneration === flushGeneration
      )
        flushingScope.current = null;
    }
  }, [
    handleSaveBarrier,
    identityGeneration,
    isCurrentOperation,
    owner,
    qc,
    queryKey,
    save,
    scope,
    setSyncForOwner,
    userId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUp = () => {
      void flush();
    };
    window.addEventListener("online", onUp);
    void flush();
    const timer = window.setInterval(onUp, 30_000);
    return () => {
      window.removeEventListener("online", onUp);
      window.clearInterval(timer);
    };
  }, [flush]);

  const mutateAsync = mutation.mutateAsync;
  const update = useCallback(
    (next: CareerState) => {
      const operationGeneration = identityGeneration;
      const operationOwner = owner;
      const currentEpoch = readCareerEpoch(operationOwner);
      const operationGate = mutationGate.current;
      const old = qc.getQueryData<CareerQueryData>(queryKey);
      const operationEpoch = captureCareerMutationEpoch(old, currentEpoch);
      if (
        resetting.current ||
        operationEpoch === null ||
        operationEpoch !== currentEpoch ||
        !canMutateCareer(careerStatus) ||
        (careerStatus === "offline" && !hasCareerSnapshot) ||
        (userId !== null && (old?.generation === null || old?.generation === undefined)) ||
        tombstoneRef.current !== null ||
        !isCurrentOwner(operationOwner, operationGeneration)
      )
        return;
      if (!operationGate.tryAcquire(operationGeneration)) return;
      // An older reconciliation must not replace this optimistic update or
      // enqueue its stale local snapshot after a slow cloud read finishes.
      void qc.cancelQueries({ queryKey, exact: true }, { revert: false });
      const prepared = old?.career
        ? recordWorldTransition(old.career, next)
        : withCareerWorld(next);
      if (userId === null)
        qc.setQueryData(queryKey, {
          career: prepared,
          sync: old?.sync ?? "local",
          status: "ready",
          generation: old?.generation ?? null,
          tombstone: null,
          epoch: operationEpoch,
        });
      else setSyncForOwner(operationOwner, "pending", operationGeneration);
      activeSaveCount.current += 1;
      const rollback = (input: CareerMutationInput) => {
        if (!isCurrentOperation(input.owner, input.identityGeneration)) return;
        if (input.epoch === null || readCareerEpoch(input.owner) !== input.epoch) {
          void qc.invalidateQueries({
            queryKey: careerQueryKey(input.scope, input.identityGeneration),
            exact: true,
          });
          return;
        }
        qc.setQueryData(careerQueryKey(input.scope, input.identityGeneration), {
          career: input.previous?.career ?? null,
          sync: "pending" as const,
          status: "error" as const,
          generation: input.previous?.generation ?? null,
          tombstone: input.previous?.tombstone ?? null,
          epoch: input.epoch,
        });
        setSyncForOwner(input.owner, "pending", input.identityGeneration);
      };
      const input: CareerMutationInput = {
        state: prepared,
        previous: old,
        owner: operationOwner,
        userId,
        scope,
        identityGeneration: operationGeneration,
        epoch: operationEpoch,
      };
      void mutateAsync(input)
        .then((outcome) => {
          if (!outcome) return;
          if (outcome.ok) {
            if (outcome.stale && isCurrentOperation(operationOwner, operationGeneration))
              void qc.invalidateQueries({ queryKey, exact: true });
            return;
          }
          rollback(input);
        })
        .catch(() => {
          rollback(input);
        })
        .finally(() => {
          operationGate.release(operationGeneration);
          if (isCurrentOperation(operationOwner, operationGeneration))
            activeSaveCount.current = Math.max(0, activeSaveCount.current - 1);
        });
    },
    [
      careerStatus,
      hasCareerSnapshot,
      isCurrentOwner,
      isCurrentOperation,
      identityGeneration,
      mutateAsync,
      owner,
      qc,
      queryKey,
      scope,
      setSyncForOwner,
      userId,
    ],
  );

  const create = useCallback(
    async (next: CareerState) => {
      const createOwner = owner;
      const createUser = userId;
      const createGeneration = identityGeneration;
      const createKey = queryKey;
      const createEpoch = readCareerEpoch(owner);
      const createGate = mutationGate.current;
      const isActive = () => isCurrentOperation(createOwner, createGeneration);
      if (createUser === undefined || createEpoch === null || resetting.current || !isActive())
        return false;
      if (!createGate.tryAcquire(createGeneration)) return false;
      activeSaveCount.current += 1;
      try {
        const prepared = withCareerWorld(next);
        if (createUser === null) {
          const saved = await saveLocalCareer(prepared, "create", createOwner, {
            expectedEpoch: createEpoch,
          });
          if (!saved || !isActive() || readCareerEpoch(createOwner) !== createEpoch) return false;
          qc.setQueryData(createKey, {
            career: prepared,
            sync: "local" as const,
            status: "ready" as const,
            generation: null,
            tombstone: null,
            epoch: createEpoch,
          });
          setSyncForOwner(createOwner, "local", createGeneration);
          return true;
        }

        const current = qc.getQueryData<CareerQueryData>(createKey);
        const expectedGeneration =
          tombstoneRef.current?.generation ??
          current?.generation ??
          (await readLocalCareerGeneration(createOwner));
        if (!isActive()) return false;
        const coordinated = await withCareerLock(
          createOwner,
          async () => {
            if (!isActive()) return false;
            if (expectedGeneration === null && current?.career) {
              await markLocalCareerSyncBlock(
                {
                  reason: "unknown_generation",
                  generation: null,
                  blockedAt: new Date().toISOString(),
                },
                createOwner,
                { lockHeld: true, expectedEpoch: createEpoch },
              );
              if (isActive()) setSyncForOwner(createOwner, "pending", createGeneration);
              return false;
            }
            setSyncForOwner(createOwner, "syncing", createGeneration);
            let result: Awaited<ReturnType<typeof createRemote>>;
            try {
              result = await createRemote({
                data: {
                  state: prepared,
                  expectedOwnerId: createUser,
                  expectedGeneration,
                },
              });
            } catch {
              if (isActive()) setSyncForOwner(createOwner, "pending", createGeneration);
              return false;
            }
            if (!isActive()) return false;
            if (!result.ok) {
              await handleSaveBarrier(result, createOwner, createGeneration, createEpoch, true);
              if (!isActive()) return false;
              setSyncForOwner(createOwner, "pending", createGeneration);
              void qc.invalidateQueries({ queryKey: createKey });
              return false;
            }
            const previousTombstone =
              tombstoneRef.current ?? (await readLocalCareerTombstone(createOwner));
            if (!isActive()) return false;
            if (
              !(await setLocalCareerGeneration(result.generation, createOwner, {
                lockHeld: true,
                expectedEpoch: createEpoch,
              }))
            ) {
              if (isActive()) setSyncForOwner(createOwner, "pending", createGeneration);
              return false;
            }
            if (!isActive()) return false;
            if (
              !(await saveLocalCareer(prepared, "create", createOwner, {
                lockHeld: true,
                generation: result.generation,
                allowPendingBarrier: Boolean(previousTombstone),
                expectedEpoch: createEpoch,
              }))
            ) {
              if (isActive()) setSyncForOwner(createOwner, "pending", createGeneration);
              return false;
            }
            if (!isActive()) return false;
            if (previousTombstone) {
              if (
                !(await clearLocalCareerTombstone(createOwner, {
                  lockHeld: true,
                  expectedEpoch: createEpoch,
                }))
              ) {
                if (isActive()) {
                  setSyncForOwner(createOwner, "pending", createGeneration);
                  void qc.invalidateQueries({ queryKey: createKey });
                }
                return false;
              }
            } else if (
              !(await clearLocalCareerSyncBlock(createOwner, {
                lockHeld: true,
                expectedEpoch: createEpoch,
              }))
            ) {
              if (isActive()) setSyncForOwner(createOwner, "pending", createGeneration);
              return false;
            }
            if (!isActive()) return false;
            tombstoneRef.current = null;
            qc.setQueryData(createKey, {
              career: prepared,
              sync: "synced" as const,
              status: "ready" as const,
              generation: result.generation,
              tombstone: null,
              epoch: createEpoch,
            });
            setSyncForOwner(createOwner, "synced", createGeneration);
            return true;
          },
          createEpoch,
        );
        if (!isActive()) return false;
        return coordinated.acquired && coordinated.value === true;
      } finally {
        createGate.release(createGeneration);
        if (isActive()) activeSaveCount.current = Math.max(0, activeSaveCount.current - 1);
      }
    },
    [
      createRemote,
      handleSaveBarrier,
      identityGeneration,
      isCurrentOperation,
      owner,
      qc,
      queryKey,
      setSyncForOwner,
      userId,
    ],
  );

  const reset = useCallback(async (): Promise<CareerResetOutcome> => {
    if (resetting.current || !canResetCareer(careerStatus) || userId === undefined)
      return { ok: false, reason: "preflight" };
    const resetOwner = owner;
    const resetUser = userId;
    const resetGeneration = identityGeneration;
    const resetKey = queryKey;
    const resetGate = mutationGate.current;
    const isActive = () => isCurrentOperation(resetOwner, resetGeneration);
    let resetTombstone: CareerTombstone | null = null;
    if (!isActive()) return { ok: false, reason: "identity_changed" };
    if (!resetGate.tryAcquire(resetGeneration)) return { ok: false, reason: "preflight" };
    resetting.current = true;
    try {
      await qc.cancelQueries({ queryKey: resetKey, exact: true }, { revert: false });
      if (!isActive()) return { ok: false, reason: "identity_changed" };
      const outcome = await resetCareerSafely({
        status: careerStatus,
        owner: resetOwner,
        userId: resetUser,
        getSync: () => syncRef.current,
        isSaving: () =>
          isActive() && (activeSaveCount.current > 0 || flushingScope.current?.scope === scope),
        isOnline,
        isCurrentOwner: (candidate) => isActive() && isCurrentOwner(candidate, resetGeneration),
        readOutbox: async (candidate) => {
          const pending = await readOutbox(candidate);
          if (!isActive()) throw new Error("stale career reset outbox read");
          return pending;
        },
        hasSyncBlock: async (candidate) => {
          const block = await readLocalCareerSyncBlock(candidate);
          return isActive() ? block !== null : true;
        },
        wipeRemote: async (expectedOwnerId) => {
          const result = await wipe({ data: { expectedOwnerId } });
          const tombstone = { generation: result.generation, deletedAt: result.deletedAt };
          if (isActive()) resetTombstone = tombstone;
          return tombstone;
        },
        persistTombstone: async (tombstoneOwner, tombstone) => {
          if (!isActive()) return true;
          const resetEpoch = readCareerEpoch(tombstoneOwner);
          const persisted = await markLocalCareerTombstone(tombstone, tombstoneOwner, {
            lockHeld: true,
            ...(resetEpoch !== null ? { expectedEpoch: resetEpoch } : {}),
          });
          return isActive() ? persisted : true;
        },
        clearLocal: async (clearOwner) => {
          if (!isActive()) return true;
          const resetEpoch = readCareerEpoch(clearOwner);
          const cleared = await clearLocalCareer(clearOwner, {
            lockHeld: true,
            ...(resetEpoch !== null ? { expectedEpoch: resetEpoch } : {}),
          });
          return isActive() ? cleared : true;
        },
        beginReset: (resetOwnerForEpoch) => isActive() && markCareerReset(resetOwnerForEpoch),
        withCrossTabLock: withCareerLock,
      });
      if (!isActive()) return { ok: false, reason: "identity_changed" };
      const confirmedTombstone = outcome.tombstone ?? resetTombstone;
      if (confirmedTombstone && isActive()) {
        tombstoneRef.current = confirmedTombstone;
        qc.setQueryData(resetKey, {
          career: null,
          sync: outcome.ok ? "synced" : "pending",
          status: "tombstoned",
          generation: confirmedTombstone.generation,
          tombstone: confirmedTombstone,
        });
        setSyncForOwner(resetOwner, outcome.ok ? "synced" : "pending", resetGeneration);
      } else if (outcome.ok && isActive()) {
        qc.setQueryData(resetKey, {
          career: null,
          sync: "local",
          status: "empty",
          generation: null,
          tombstone: null,
        });
        setSyncForOwner(resetOwner, "local", resetGeneration);
      }
      if (isActive() && !outcome.ok && outcome.reason === "remote_unconfirmed")
        void qc.invalidateQueries({ queryKey: resetKey });
      return outcome;
    } finally {
      resetGate.release(resetGeneration);
      if (isActive()) resetting.current = false;
    }
  }, [
    careerStatus,
    identityGeneration,
    isCurrentOperation,
    isCurrentOwner,
    owner,
    qc,
    queryKey,
    scope,
    setSyncForOwner,
    userId,
    wipe,
  ]);

  return {
    career: (query.data?.career ?? null) as CareerState | null,
    isLoading: careerStatus === "loading",
    saving: mutation.isPending,
    signedIn,
    sync,
    status: careerStatus,
    retry,
    create,
    update,
    reset,
  };
}
