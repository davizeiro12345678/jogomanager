import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { migrateCareer } from "@/game/career";
import { recordWorldTransition, withCareerWorld } from "@/game/career-world";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { loadCareer, saveCareer, deleteCareer } from "@/lib/career.functions";
import {
  clearLocalCareer,
  clearOutbox,
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
    queryFn: async (): Promise<{ career: CareerState | null; sync: SyncState }> => {
      const local = await loadLocalCareer(owner);
      // Migration is in memory only: rewriting the save here would bump its
      // timestamp and let a stale local copy beat newer cloud progress.
      const repairLocal = async (raw: CareerState) => migrateCareer(raw);
      if (!isCurrentOwner(owner)) return { career: null, sync: "local" };
      if (!userId) return { career: local ? await repairLocal(local) : null, sync: "local" };
      if (!isOnline()) return { career: local ? await repairLocal(local) : null, sync: "offline" };

      let cloud: CareerState | null = null;
      let cloudAt = 0;
      try {
        const raw = await load();
        if (!isCurrentOwner(owner)) return { career: null, sync: "local" };
        if (raw) {
          cloud = raw.state as CareerState;
          cloudAt = raw.updatedAt ? Date.parse(raw.updatedAt) : 0;
        }
      } catch {
        return { career: local ? await repairLocal(local) : null, sync: "offline" };
      }

      const localAt = await localSavedAt(owner);
      if (!isCurrentOwner(owner)) return { career: null, sync: "local" };
      // Conflito resolvido por data: a versão mais recente vence.
      if (local && (!cloud || localAt > cloudAt)) {
        const migrated = await repairLocal(local);
        try {
          if (!isCurrentOwner(owner)) return { career: null, sync: "local" };
          await save({ data: { state: migrated } });
          return { career: migrated, sync: "synced" };
        } catch {
          await queueSync(migrated, owner);
          return { career: migrated, sync: "pending" };
        }
      }
      if (cloud) {
        const migrated = await repairLocal(cloud);
        if (isCurrentOwner(owner)) await saveLocalCareer(migrated, "nuvem", owner);
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
      if (!isOnline()) {
        await queueSync(state, mutationOwner);
        setSyncForOwner(mutationOwner, "offline");
        return { ok: true };
      }
      setSyncForOwner(mutationOwner, "syncing");
      try {
        await save({ data: { state } });
        if (!isCurrentOwner(mutationOwner)) return { ok: true, stale: true };
        await clearOutbox(mutationOwner);
        setSyncForOwner(mutationOwner, "synced");
      } catch {
        await queueSync(state, mutationOwner);
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
    if (!entry || !isCurrentOwner(flushOwner)) return;
    flushingScope.current = scope;
    setSyncForOwner(flushOwner, "syncing");
    try {
      await save({ data: { state: migrateCareer(entry.state) } });
      if (!isCurrentOwner(flushOwner)) return;
      await clearOutbox(flushOwner);
      setSyncForOwner(flushOwner, "synced");
    } catch {
      setSyncForOwner(flushOwner, "pending");
    } finally {
      if (flushingScope.current === scope) flushingScope.current = null;
    }
  }, [isCurrentOwner, owner, save, scope, setSyncForOwner, userId]);

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
        await wipe();
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
