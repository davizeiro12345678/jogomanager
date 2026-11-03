import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface StoredServices {
  injuryTreatments: number;
  opponentReports: number;
}

const NONE: StoredServices = { injuryTreatments: 0, opponentReports: 0 };

/** Treatments and opponent reports bought in shop packs, waiting to be used.
 * Lives under the ["wallet"] key so service spends refresh it. */
export function useStoredServices(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["wallet", "stored-services", userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<StoredServices> => {
      if (!userId) return NONE;
      const { data, error } = await supabase
        .from("user_wallet")
        .select("injury_treatments, opponent_reports")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { injuryTreatments: data.injury_treatments, opponentReports: data.opponent_reports }
        : NONE;
    },
  });
}
