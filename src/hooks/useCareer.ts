import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { migrateCareer } from "@/game/career";
import { supabase } from "@/integrations/supabase/client";
import { loadCareer, saveCareer, deleteCareer } from "@/lib/career.functions";
import { clearLocalCareer, readLocalCareer, writeLocalCareer } from "@/lib/careerStorage";
import type { CareerState } from "@/game/types";

export const CAREER_KEY = ["career"] as const;

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
 * Career persistence that works with or without an account.
 * Guests are saved in localStorage; signed-in users are saved in the cloud,
 * and a local career is uploaded automatically on the first cloud load.
 */
export function useCareer() {
  const qc = useQueryClient();
  const signedIn = useSignedIn();
  const load = useServerFn(loadCareer);
  const save = useServerFn(saveCareer);
  const wipe = useServerFn(deleteCareer);

  const query = useQuery({
    queryKey: [...CAREER_KEY, signedIn],
    enabled: signedIn !== null,
    queryFn: async () => {
      const local = readLocalCareer();
      if (!signedIn) return local ? migrateCareer(local) : null;

      const raw = await load();
      if (raw) return migrateCareer(raw);
      if (local) {
        // First sign-in with a guest career: push it to the cloud.
        const migrated = migrateCareer(local);
        await save({ data: { state: migrated } });
        return migrated;
      }
      return null;
    },
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (state: CareerState) => {
      writeLocalCareer(state);
      if (signedIn) await save({ data: { state } });
      return { ok: true };
    },
  });

  const update = useCallback(
    (next: CareerState) => {
      qc.setQueryData([...CAREER_KEY, signedIn], next);
      mutation.mutate(next);
    },
    [qc, mutation, signedIn],
  );

  const reset = useCallback(async () => {
    clearLocalCareer();
    if (signedIn) await wipe();
    qc.setQueryData([...CAREER_KEY, signedIn], null);
  }, [qc, wipe, signedIn]);

  return {
    career: (query.data ?? null) as CareerState | null,
    isLoading: signedIn === null || query.isLoading,
    saving: mutation.isPending,
    signedIn,
    update,
    reset,
  };
}
