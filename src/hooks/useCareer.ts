import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { migrateCareer } from "@/game/career";
import { recordWorldTransition, withCareerWorld } from "@/game/career-world";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { loadCareer, saveCareer, deleteCareer } from "@/lib/career.functions";
import {
  clearLocalCareer,
  acknowledgeOutbox,
  isOnline,
  loadLocalCareer,
  localSavedAt,
  queueSync,
  readOutbox,
  saveLocalCareer,
  type LocalOwnerId,
} from "@/lib/offline/store";
import type { CareerState } from "@/game/types";

export const CAREER_KEY = ["career"] as const;

export type SyncState = "local" | "syncing" | "synced" | "pending" | "offline";

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
  const currentOwner = useRef<string | null | undefined>(userId);
  // Updating the ref during render closes the small gap before effects run when
  // a sign-in/sign-out swaps the active account.
  currentOwner.current = userId;
  const isCurrentOwner = useCallback(
    (candidate: LocalOwnerId) =>
      currentOwner.current !== undefined && currentOwner.current === candidate,
    [],
  );

  const load = useServerFn(loadCareer);
  const save = useServerFn(saveCareer);
  const wipe = useServerFn(deleteCareer);
  const [sync, setSync] = useState<SyncState>("local");
  const flushingScope = useRef<string | null>(null);

  const query = useQuery({
    queryKey: [...CAREER_KEY, scope],
    enabled: userId !== undefined,
    queryFn: async ({ signal }): Promise<{ career: CareerState | null; sync: SyncState }> => {
      const isActive = () => !signal.aborted && isCurrentOwner(owner);
      const local = await loadLocalCareer(owner);
      // Migration is in memory only: rewriting the save here would bump its
      // timestamp and let a stale local copy beat newer cloud progress.
      const repairLocal = async (raw: CareerState) => migrateCareer(raw);
      if (!isActive()) return { career: null, sync: "local" };
      if (!userId) return { career: local ? await repairLocal(local) : null, sync: "local" };
      if (!isOnline()) return { career: local ? await repairLocal(local) : null, sync: "offline" };

      let cloud: CareerState | null = null;
      let cloudAt = 0;
      try {
        const raw = await load();
        if (!isActive()) return { career: null, sync: "local" };
        if (raw) {
          cloud = raw.state as CareerState;
          cloudAt = raw.updatedAt ? Date.parse(raw.updatedAt) : 0;
        }
      } catch {
        return { career: local ? await repairLocal(local) : null, sync: "offline" };
      }

      const localAt = await localSavedAt(owner);
      if (!isActive()) return { career: null, sync: "local" };
      // Conflito resolvido por data: a versão mais recente vence.
      if (local && (!cloud || localAt > cloudAt)) {
        const migrated = await repairLocal(local);
        if (!isActive()) return { career: null, sync: "local" };
        const pending = await queueSync(migrated, owner);
        if (!isActive()) return { career: null, sync: "local" };
        try {
          const res = await save({ data: { state: migrated, expectedOwnerId: userId } });
          const acknowledged = await acknowledgeOutbox(pending, owner);
          // A newer timestamp is not newer progress: keep the cloud career.
          if (!res.stale) return { career: migrated, sync: acknowledged ? "synced" : "pending" };
          // A concurrent writer may have advanced since our first cloud read.
          // Fetch that winning revision instead of restoring the old snapshot.
          if (!isActive()) return { career: null, sync: "local" };
          const latest = await load();
          if (!isActive()) return { career: null, sync: "local" };
          cloud = latest?.state ? (latest.state as CareerState) : null;
        } catch {
          return { career: migrated, sync: "pending" };
        }
      }
      if (cloud) {
        const migrated = await repairLocal(cloud);
        if (isActive()) await saveLocalCareer(migrated, "nuvem", owner);
        return { career: migrated, sync: "synced" };
      }
      return { career: null, sync: "local" };
    },
    staleTime: 30_000,
  });

  // Clear the previous account's status immediately. Query data is separately
  // keyed, but an old pending label must not appear during the identity switch.
  useEffect(() => {
    setSync("local");
  }, [scope]);

  // O estado de sincronização só é aplicado depois da montagem: alterá-lo
  // dentro do queryFn atualizava um componente ainda não montado.
  const querySync = query.data?.sync;
  useEffect(() => {
    if (querySync) setSync(querySync);
  }, [querySync]);

  const setSyncForOwner = useCallback(
    (candidate: LocalOwnerId, next: SyncState) => {
      if (isCurrentOwner(candidate)) setSync(next);
    },
    [isCurrentOwner],
  );

  const mutation = useMutation({
    mutationFn: async (state: CareerState) => {
      const mutationOwner = owner;
      const mutationUser = userId;
      await saveLocalCareer(state, "auto", mutationOwner);
      if (!isCurrentOwner(mutationOwner)) return { ok: true, stale: true };
      if (!mutationUser) {
        setSyncForOwner(mutationOwner, "local");
        return { ok: true };
      }
      // Queue before sending: a later failure must never overwrite a newer
      // pending save, and completion acknowledges only this upload's revision.
      const pending = await queueSync(state, mutationOwner);
      if (!isCurrentOwner(mutationOwner)) return { ok: true, stale: true };
      if (!isOnline()) {
        setSyncForOwner(mutationOwner, "offline");
        return { ok: true };
      }
      setSyncForOwner(mutationOwner, "syncing");
      try {
        const res = await save({ data: { state, expectedOwnerId: mutationUser } });
        const acknowledged = await acknowledgeOutbox(pending, mutationOwner);
        setSyncForOwner(mutationOwner, acknowledged ? "synced" : "pending");
        // The cloud has newer progress: reload it instead of keeping the old copy.
        if (res.stale) void qc.invalidateQueries({ queryKey: [...CAREER_KEY, scope] });
      } catch {
        setSyncForOwner(mutationOwner, "pending");
      }
      return { ok: true };
    },
  });

  // Envia a fila assim que a conexão volta, sem deixar uma conta drenar a fila
  // persistida de outra durante uma troca de sessão.
  const flush = useCallback(async () => {
    const flushOwner = owner;
    if (!userId || flushingScope.current === scope || !isOnline()) return;
    const entry = await readOutbox(flushOwner);
    if (!entry || !isCurrentOwner(flushOwner) || flushingScope.current === scope) return;
    flushingScope.current = scope;
    setSyncForOwner(flushOwner, "syncing");
    try {
      const res = await save({
        data: { state: migrateCareer(entry.state), expectedOwnerId: userId },
      });
      const acknowledged = await acknowledgeOutbox(entry, flushOwner);
      setSyncForOwner(flushOwner, acknowledged ? "synced" : "pending");
      if (res.stale) void qc.invalidateQueries({ queryKey: [...CAREER_KEY, scope] });
    } catch {
      setSyncForOwner(flushOwner, "pending");
    } finally {
      if (flushingScope.current === scope) flushingScope.current = null;
    }
  }, [isCurrentOwner, owner, qc, save, scope, setSyncForOwner, userId]);

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

  const mutate = mutation.mutate;
  const update = useCallback(
    (next: CareerState) => {
      // An older reconciliation must not replace this optimistic update or
      // enqueue its stale local snapshot after a slow cloud read finishes.
      void qc.cancelQueries({ queryKey: [...CAREER_KEY, scope], exact: true }, { revert: false });
      const old = qc.getQueryData<{ career: CareerState | null; sync: SyncState }>([
        ...CAREER_KEY,
        scope,
      ]);
      const prepared = old?.career
        ? recordWorldTransition(old.career, next)
        : withCareerWorld(next);
      qc.setQueryData([...CAREER_KEY, scope], { career: prepared, sync: old?.sync ?? "local" });
      mutate(prepared);
    },
    [qc, mutate, scope],
  );

  const reset = useCallback(async () => {
    const resetOwner = owner;
    const resetUser = userId;
    await clearLocalCareer(resetOwner);
    if (resetUser && isOnline() && isCurrentOwner(resetOwner)) {
      try {
        await wipe({ data: { expectedOwnerId: resetUser } });
      } catch {
        /* offline: a carreira local já foi apagada */
      }
    }
    if (isCurrentOwner(resetOwner)) {
      qc.setQueryData([...CAREER_KEY, scope], (old: { sync: SyncState } | undefined) => ({
        career: null,
        sync: old?.sync ?? "local",
      }));
    }
  }, [isCurrentOwner, owner, qc, scope, userId, wipe]);

  return {
    career: (query.data?.career ?? null) as CareerState | null,
    isLoading: userId === undefined || query.isLoading,
    saving: mutation.isPending,
    signedIn,
    sync,
    update,
    reset,
  };
}
