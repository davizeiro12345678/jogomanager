import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerCareerState } from "@/game/player-career/types";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { deleteAthlete, listAthletes, readAthlete, writeAthlete } from "@/lib/player-career-store";
import { deleteAthleteCloud, loadAthletesCloud, saveAthleteCloud } from "@/lib/player-career.functions";

/** Lista os 3 espaços de atleta. A nuvem só substitui o local se for mais nova. */
export function useAthleteSlots() {
  const userId = useAuthUserId();
  const [slots, setSlots] = useState<(PlayerCareerState | null)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => setSlots(listAthletes()), []);
  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!userId) return;
    loadAthletesCloud()
      .then((rows) => {
        for (const row of rows) {
          const cloud = row.state as PlayerCareerState;
          const local = readAthlete(row.slot);
          if (cloud?.version === 1 && (!local || cloud.updatedAt > local.updatedAt)) writeAthlete({ ...cloud, slot: row.slot as 1 | 2 | 3 });
        }
        refresh();
      })
      .catch(() => setError("Não foi possível buscar seus atletas na nuvem. Os salvos no aparelho continuam disponíveis."));
  }, [userId, refresh]);

  const remove = useCallback(
    async (slot: number) => {
      deleteAthlete(slot);
      refresh();
      if (userId) await deleteAthleteCloud({ data: { slot } }).catch(() => undefined);
    },
    [userId, refresh],
  );

  return { slots, error, remove, signedIn: !!userId };
}

export function useAthlete(slot: number) {
  const userId = useAuthUserId();
  const [state, setState] = useState<PlayerCareerState | null | undefined>(undefined);
  const [syncError, setSyncError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setState(readAthlete(slot)), [slot]);

  const commit = useCallback(
    (next: PlayerCareerState) => {
      writeAthlete(next);
      setState(next);
      if (!userId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        saveAthleteCloud({ data: { slot: next.slot, state: next as never } })
          .then(() => setSyncError(false))
          .catch(() => setSyncError(true));
      }, 1500);
    },
    [userId],
  );

  return { state, commit, syncError, signedIn: !!userId };
}
