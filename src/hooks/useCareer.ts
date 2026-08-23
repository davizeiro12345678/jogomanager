import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import { loadCareer, saveCareer, deleteCareer } from "@/lib/career.functions";
import type { CareerState } from "@/game/types";

export const CAREER_KEY = ["career"] as const;

export function useCareer() {
  const qc = useQueryClient();
  const load = useServerFn(loadCareer);
  const save = useServerFn(saveCareer);
  const wipe = useServerFn(deleteCareer);

  const query = useQuery({
    queryKey: CAREER_KEY,
    queryFn: () => load(),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (state: CareerState) => save({ data: { state } }),
  });

  const update = useCallback(
    (next: CareerState) => {
      qc.setQueryData(CAREER_KEY, next);
      mutation.mutate(next);
    },
    [qc, mutation],
  );

  const reset = useCallback(async () => {
    await wipe();
    qc.setQueryData(CAREER_KEY, null);
  }, [qc, wipe]);

  return {
    career: (query.data ?? null) as CareerState | null,
    isLoading: query.isLoading,
    saving: mutation.isPending,
    update,
    reset,
  };
}
