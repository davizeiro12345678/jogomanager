import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { migrateCareer } from "@/game/career";
import { recordWorldTransition, withCareerWorld } from "@/game/career-world";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/lib/offline/store";
import type { CareerState } from "@/game/types";

export const CAREER_KEY = ["career"] as const;

export type SyncState = "local" | "syncing" | "synced" | "pending" | "offline";

/** Tracks whether a Supabase session exists. `null` while unknown. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSignedIn(!!session);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}

/**
 * Persistência da carreira que funciona com ou sem conta e com ou sem internet.
 *
 * - Sempre grava primeiro no aparelho (IndexedDB + espelho no localStorage).
 * - Com conta e conexão, envia para a nuvem.
 * - Sem conexão, guarda na fila e envia sozinho quando a internet voltar.
 */
export function useCareer() {
  const qc = useQueryClient();
  const signedIn = useSignedIn();
  const load = useServerFn(loadCareer);
  const save = useServerFn(saveCareer);
  const wipe = useServerFn(deleteCareer);
  const [sync, setSync] = useState<SyncState>("local");
  const flushing = useRef(false);

  const query = useQuery({
    queryKey: [...CAREER_KEY, signedIn],
    enabled: signedIn !== null,
    queryFn: async (): Promise<{ career: CareerState | null; sync: SyncState }> => {
      const local = await loadLocalCareer();
      if (!signedIn) return { career: local ? migrateCareer(local) : null, sync: "local" };
      if (!isOnline()) {
        return { career: local ? migrateCareer(local) : null, sync: "offline" };
      }

      let cloud: CareerState | null = null;
      let cloudAt = 0;
      try {
        const raw = await load();
        if (raw) {
          cloud = raw.state as CareerState;
          cloudAt = raw.updatedAt ? Date.parse(raw.updatedAt) : 0;
        }
      } catch {
        return { career: local ? migrateCareer(local) : null, sync: "offline" };
      }

      const localAt = await localSavedAt();
      // Conflito resolvido por data: a versão mais recente vence.
      if (local && (!cloud || localAt > cloudAt)) {
        const migrated = migrateCareer(local);
        try {
          await save({ data: { state: migrated } });
          return { career: migrated, sync: "synced" };
        } catch {
          await queueSync(migrated);
          return { career: migrated, sync: "pending" };
        }
      }
      if (cloud) {
        const migrated = migrateCareer(cloud);
        await saveLocalCareer(migrated, "nuvem");
        return { career: migrated, sync: "synced" };
      }
      return { career: null, sync: "local" };
    },
    staleTime: 30_000,
  });

  // O estado de sincronização só é aplicado depois da montagem: alterá-lo
  // dentro do queryFn atualizava um componente ainda não montado.
  const querySync = query.data?.sync;
  useEffect(() => {
    if (querySync) setSync(querySync);
  }, [querySync]);

  const mutation = useMutation({
    mutationFn: async (state: CareerState) => {
      await saveLocalCareer(state);
      if (!signedIn) {
        setSync("local");
        return { ok: true };
      }
      if (!isOnline()) {
        await queueSync(state);
        setSync("offline");
        return { ok: true };
      }
      setSync("syncing");
      try {
        await save({ data: { state } });
        await clearOutbox();
        setSync("synced");
      } catch {
        await queueSync(state);
        setSync("pending");
      }
      return { ok: true };
    },
  });

  // Envia a fila assim que a conexão volta.
  const flush = useCallback(async () => {
    if (!signedIn || flushing.current || !isOnline()) return;
    const entry = await readOutbox();
    if (!entry) return;
    flushing.current = true;
    setSync("syncing");
    try {
      await save({ data: { state: entry.state } });
      await clearOutbox();
      setSync("synced");
    } catch {
      setSync("pending");
    } finally {
      flushing.current = false;
    }
  }, [signedIn, save]);

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
        signedIn,
      ]);
      const prepared = old?.career
        ? recordWorldTransition(old.career, next)
        : withCareerWorld(next);
      qc.setQueryData([...CAREER_KEY, signedIn], { career: prepared, sync: old?.sync ?? "local" });
      mutate(prepared);
    },
    [qc, mutate, signedIn],
  );

  const reset = useCallback(async () => {
    await clearLocalCareer();
    if (signedIn && isOnline()) {
      try {
        await wipe();
      } catch {
        /* offline: a carreira local já foi apagada */
      }
    }
    qc.setQueryData([...CAREER_KEY, signedIn], (old: { sync: SyncState } | undefined) => ({
      career: null,
      sync: old?.sync ?? "local",
    }));
  }, [qc, wipe, signedIn]);

  return {
    career: (query.data?.career ?? null) as CareerState | null,
    isLoading: signedIn === null || query.isLoading,
    saving: mutation.isPending,
    signedIn,
    sync,
    update,
    reset,
  };
}
