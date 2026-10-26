import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef } from "react";

import { recordWorldTransition, withCareerWorld } from "@/game/career-world";
import { supabase } from "@/integrations/supabase/client";
import { loadCareer, saveCareer, deleteCareer } from "@/lib/career.functions";
import {
  backupCareerBeforeMigration,
  clearLocalCareer,
  isOnline,
  loadLocalCareer,
  localSavedAt,
  queueSync,
  saveLocalCareer,
} from "@/lib/offline/store";
import { flushCareerSync } from "@/lib/offline/sync";
import type { CareerState } from "@/game/types";

import { useAuthUserId } from "./useAuthUserId";
import { careerQueryEnabled, careerQueryPolicy } from "./career-query-policy";
import {
  applyCareerSync,
  beginCareerSave,
  careerFeedbackSync,
  careerSyncGuard,
  CAREER_SAVE_ERROR,
  clearCareerMemory,
  failCareerSave,
  hasUnpersistedCareer,
  preserveCareerMemory,
  publishVerifiedRestore,
  retainCareerRestoreSources,
  verifyCareerSave,
  type CareerQueryData,
  type CareerSaveTicket,
  type CareerSyncState,
} from "./career-save-feedback";

export const CAREER_KEY = ["career"] as const;

export type SyncState = CareerSyncState;
class StaleCareerUpload extends Error {}

// A visitor without a saved career does not need the migration/season engine.
// Keep the authoritative migration on the existing asynchronous load/sync path.
async function migrateStoredCareer(state: CareerState): Promise<CareerState> {
  const { migrateCareer } = await import("@/game/career/migration");
  return migrateCareer(state);
}

/** Tracks whether a Supabase session exists. `null` while unknown. */
export function useSignedIn() {
  const userId = useAuthUserId();
  return userId === undefined ? null : userId !== null;
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
  const userId = useAuthUserId();
  const signedIn = userId === undefined ? null : userId !== null;
  const owner = userId ?? null;
  const currentOwner = useRef<string | null | undefined>(userId);
  currentOwner.current = userId;
  const isCurrentOwner = useCallback(
    (candidate: string | null) =>
      currentOwner.current !== undefined && currentOwner.current === candidate,
    [],
  );
  const assertCurrentOwner = useCallback(async () => {
    if (!isCurrentOwner(owner))
      throw new Error("A conta mudou. Reabra a carreira antes de continuar.");
    const { data, error } = await supabase.auth.getSession();
    if (error || !isCurrentOwner(owner) || (data.session?.user.id ?? null) !== owner) {
      throw new Error("A conta mudou. Reabra a carreira antes de continuar.");
    }
  }, [owner, isCurrentOwner]);
  const load = useServerFn(loadCareer);
  const save = useServerFn(saveCareer);
  const wipe = useServerFn(deleteCareer);
  const flushing = useRef(false);
  const syncOwner = useCallback(
    () =>
      flushCareerSync(owner, {
        assertOwner: assertCurrentOwner,
        upload: async (state) => {
          const result = await save({ data: { state, expectedOwnerId: userId! } });
          if (result.stale)
            throw new StaleCareerUpload(
              "Há progresso mais recente na nuvem. A cópia local permanece pendente para revisão.",
            );
          if (!result.ok) throw new Error("Não foi possível confirmar a sincronização.");
          return result;
        },
        prepare: migrateStoredCareer,
      }),
    [owner, assertCurrentOwner, save, userId],
  );

  const query = useQuery<CareerQueryData>({
    ...careerQueryPolicy,
    queryKey: [...CAREER_KEY, userId],
    enabled:
      careerQueryEnabled(signedIn !== null, qc.getQueryState([...CAREER_KEY, userId])?.status) &&
      !hasUnpersistedCareer(qc.getQueryData<CareerQueryData>([...CAREER_KEY, userId])),
    structuralSharing: preserveCareerMemory,
    gcTime: Infinity,
    queryFn: async ({ signal }): Promise<CareerQueryData> => {
      const isActive = () => !signal.aborted && isCurrentOwner(owner);
      const readAttempt =
        qc.getQueryData<CareerQueryData>([...CAREER_KEY, userId])?.persistence?.attempt ?? 0;
      await assertCurrentOwner();
      const memory = qc.getQueryData<CareerQueryData>([...CAREER_KEY, userId]);
      if (hasUnpersistedCareer(memory)) return memory!;
      const protectedMemory = () => {
        const current = qc.getQueryData<CareerQueryData>([...CAREER_KEY, userId]);
        return hasUnpersistedCareer(current) || (current?.persistence?.attempt ?? 0) > readAttempt
          ? current
          : null;
      };
      const finish = (result: CareerQueryData): CareerQueryData =>
        !isActive()
          ? { career: null, sync: "local" }
          : (protectedMemory() ?? { ...result, readAttempt });
      const local = await loadLocalCareer(owner);
      if (!isActive()) return { career: null, sync: "local" };
      const repairLocal = async (raw: CareerState) => {
        const current = protectedMemory();
        if (current) return current.career ?? raw;
        // Reconciliation must not give an old local save a newer timestamp.
        // Durable migration/backups remain in explicit saves and sync preparation.
        return migrateStoredCareer(raw);
      };
      if (!signedIn)
        return finish({ career: local ? await repairLocal(local) : null, sync: "local" });
      if (!isOnline()) {
        return finish({ career: local ? await repairLocal(local) : null, sync: "offline" });
      }

      let cloud: CareerState | null = null;
      let cloudAt = 0;
      try {
        const raw = await load({ data: { expectedOwnerId: userId! } });
        await assertCurrentOwner();
        if (!isActive()) return { career: null, sync: "local" };
        if (raw) {
          cloud = raw.state as CareerState;
          cloudAt = raw.updatedAt ? Date.parse(raw.updatedAt) : 0;
        }
      } catch {
        return finish({ career: local ? await repairLocal(local) : null, sync: "offline" });
      }

      const localAt = await localSavedAt(owner);
      if (!isActive()) return { career: null, sync: "local" };
      // Conflito resolvido por data: a versão mais recente vence.
      if (local && (!cloud || localAt > cloudAt)) {
        const migrated = await repairLocal(local);
        if (!isActive()) return { career: null, sync: "local" };
        const current = protectedMemory();
        if (current) return current;
        try {
          await assertCurrentOwner();
          await queueSync((await loadLocalCareer(owner)) ?? migrated, owner);
          const result = await syncOwner();
          return finish({
            career: result.state ?? migrated,
            sync: result.synced ? "synced" : "pending",
          });
        } catch (error) {
          if (error instanceof StaleCareerUpload) {
            try {
              // A concurrent writer may have advanced after our initial read.
              // Show that winning cloud revision while retaining the rejected
              // personal local/outbox copy for explicit recovery.
              const latest = await load({ data: { expectedOwnerId: userId! } });
              await assertCurrentOwner();
              if (latest?.state)
                return finish({ career: await migrateStoredCareer(latest.state), sync: "pending" });
            } catch {
              /* The retained personal copy is still recoverable offline. */
            }
          }
          return finish({ career: (await loadLocalCareer(owner)) ?? migrated, sync: "pending" });
        }
      }
      if (cloud) {
        const migrated = await repairLocal(cloud);
        const current = protectedMemory();
        if (current) return current;
        if (!isActive()) return { career: null, sync: "local" };
        await saveLocalCareer(migrated, "nuvem", owner);
        return finish({ career: migrated, sync: "synced" });
      }
      return finish({ career: null, sync: "local" });
    },
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async ({
      state,
      expectedOwner,
      replacement = false,
      write,
    }: {
      state: CareerState;
      expectedOwner: string | null;
      replacement?: boolean;
      write: CareerSaveTicket;
    }): Promise<{ ok: true; sync: SyncState }> => {
      // A file read or a match completion may finish after the account changed.
      if (expectedOwner !== owner)
        throw new Error("A conta mudou. Reabra a carreira antes de continuar.");
      await assertCurrentOwner();
      const previous = await loadLocalCareer(owner);
      const previousVersion = previous?.version as unknown;
      if (
        !replacement &&
        previous &&
        previousVersion !== undefined &&
        (typeof previousVersion !== "number" ||
          !Number.isInteger(previousVersion) ||
          previousVersion < 1 ||
          previousVersion > 3)
      )
        throw new Error(
          "Este save usa uma versão incompatível. Atualize o jogo ou restaure uma cópia explicitamente; o original foi mantido.",
        );
      await saveLocalCareer(state, "auto", owner);
      await assertCurrentOwner();
      verifyCareerSave(qc, [...CAREER_KEY, userId], write, signedIn ? "pending" : "local");
      if (!signedIn) {
        return { ok: true, sync: "local" as const };
      }
      await queueSync((await loadLocalCareer(owner)) ?? state, owner);
      if (!isOnline()) {
        applyCareerSync(qc, [...CAREER_KEY, userId], "offline", write);
        return { ok: true, sync: "offline" as const };
      }
      applyCareerSync(qc, [...CAREER_KEY, userId], "syncing", write);
      try {
        const result = await syncOwner();
        const status = result.synced ? "synced" : "pending";
        applyCareerSync(qc, [...CAREER_KEY, userId], status, write);
        return { ok: true, sync: status };
      } catch (error) {
        applyCareerSync(qc, [...CAREER_KEY, userId], "pending", write);
        if (error instanceof StaleCareerUpload)
          void qc.invalidateQueries({ queryKey: [...CAREER_KEY, userId], exact: true });
        return { ok: true, sync: "pending" as const };
      }
    },
    onError: (_error, variables) => {
      failCareerSave(qc, [...CAREER_KEY, variables.expectedOwner], variables.write);
      if (variables.write.verified)
        applyCareerSync(qc, [...CAREER_KEY, variables.expectedOwner], "pending", variables.write);
    },
  });

  // Envia a fila assim que a conexão volta.
  const flush = useCallback(async () => {
    if (!signedIn || flushing.current || !isOnline()) return;
    const key = [...CAREER_KEY, userId];
    const memory = qc.getQueryData<CareerQueryData>(key);
    if (hasUnpersistedCareer(memory)) return;
    const guard = careerSyncGuard(memory);
    flushing.current = true;
    applyCareerSync(qc, key, "syncing", guard);
    try {
      const result = await syncOwner();
      applyCareerSync(qc, key, result.synced ? "synced" : "pending", guard);
    } catch (error) {
      applyCareerSync(qc, key, "pending", guard);
      if (error instanceof StaleCareerUpload)
        void qc.invalidateQueries({ queryKey: key, exact: true });
    } finally {
      flushing.current = false;
    }
  }, [signedIn, syncOwner, qc, userId]);

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
      if (query.error) throw query.error;
      if (!isCurrentOwner(owner))
        throw new Error("A conta mudou. Reabra a carreira antes de continuar.");
      void qc.cancelQueries({ queryKey: [...CAREER_KEY, userId], exact: true }, { revert: false });
      const old = qc.getQueryData<CareerQueryData>([...CAREER_KEY, userId]);
      const prepared = old?.career
        ? recordWorldTransition(old.career, next)
        : withCareerWorld(next);
      const write = beginCareerSave(qc, [...CAREER_KEY, userId], prepared);
      mutate({ state: prepared, expectedOwner: owner, write });
    },
    [qc, mutate, userId, owner, query.error, isCurrentOwner],
  );

  // Restoring a different save is a replacement, not an in-game transition.
  // Wait for verified persistence before showing it or reporting success.
  const mutateAsync = mutation.mutateAsync;
  const restore = useCallback(
    async (next: CareerState) => {
      await assertCurrentOwner();
      await qc.cancelQueries({ queryKey: [...CAREER_KEY, userId], exact: true }, { revert: false });
      const memory = qc.getQueryData<CareerQueryData>([...CAREER_KEY, userId])?.career ?? null;
      const write = beginCareerSave(qc, [...CAREER_KEY, userId], next, false);
      const previous = await loadLocalCareer(owner);
      await retainCareerRestoreSources(memory, previous, next, (original) =>
        backupCareerBeforeMigration(original, owner),
      );
      const result = await mutateAsync({
        state: next,
        expectedOwner: owner,
        replacement: true,
        write,
      });
      await assertCurrentOwner();
      if (!publishVerifiedRestore(qc, [...CAREER_KEY, userId], write, result.sync))
        throw new Error(
          "A carreira aberta mudou durante a restauração. Confira o perfil antes de continuar.",
        );
    },
    [assertCurrentOwner, mutateAsync, owner, qc, userId],
  );

  const reset = useCallback(async () => {
    await assertCurrentOwner();
    await qc.cancelQueries({ queryKey: [...CAREER_KEY, userId], exact: true }, { revert: false });
    await clearLocalCareer(owner);
    if (signedIn && isOnline()) {
      try {
        await assertCurrentOwner();
        await wipe({ data: { expectedOwnerId: userId! } });
        await assertCurrentOwner();
      } catch {
        /* offline: a carreira local já foi apagada */
      }
    }
    clearCareerMemory(qc, [...CAREER_KEY, userId], "local");
  }, [qc, wipe, signedIn, userId, owner, assertCurrentOwner]);

  return {
    loadError: query.error
      ? query.error instanceof Error && query.error.message.includes("versão")
        ? query.error.message
        : "Não foi possível abrir a carreira. Suas cópias foram mantidas; confira a conexão e o armazenamento."
      : null,
    career: (query.data?.career ?? null) as CareerState | null,
    isLoading: signedIn === null || query.isLoading,
    saving: mutation.isPending || query.data?.persistence?.phase === "saving",
    signedIn,
    sync: careerFeedbackSync(query.data),
    saveError: careerFeedbackSync(query.data) === "unsaved" ? CAREER_SAVE_ERROR : null,
    ownerId: owner,
    update,
    restore,
    reset,
  };
}
