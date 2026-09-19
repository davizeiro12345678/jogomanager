import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface ClubHonour {
  id: string;
  competition: string;
  titleCount: number;
  seasons: string[];
  source: string;
}

export interface ClubHeritage {
  description: string | null;
  founded: number | null;
  city: string | null;
  source: string | null;
  updatedAt: string | null;
  stadium: {
    name: string;
    city: string | null;
    capacity: number | null;
    photoUrl: string | null;
  } | null;
  honours: ClubHonour[];
}

type ClubRow = {
  description: string | null;
  founded: number | null;
  city: string | null;
  data_source: string | null;
  data_updated_at: string | null;
  stadiums:
    | { name: string; city: string | null; capacity: number | null; photo_url: string | null }
    | { name: string; city: string | null; capacity: number | null; photo_url: string | null }[]
    | null;
};

export function useClubHeritage(clubId: string | undefined) {
  return useQuery({
    queryKey: ["club-heritage", clubId],
    enabled: Boolean(clubId),
    staleTime: 1000 * 60 * 60 * 12,
    queryFn: async (): Promise<ClubHeritage> => {
      if (!clubId) throw new Error("Clube não selecionado");
      const [clubResult, honoursResult] = await Promise.all([
        supabase
          .from("clubs")
          .select(
            "description, founded, city, data_source, data_updated_at, stadiums(name, city, capacity, photo_url)",
          )
          .eq("id", clubId)
          .maybeSingle(),
        supabase
          .from("club_honours")
          .select("id, competition, title_count, seasons, source")
          .eq("club_id", clubId)
          .order("title_count", { ascending: false }),
      ]);
      if (clubResult.error) throw clubResult.error;
      if (honoursResult.error) throw honoursResult.error;

      const row = clubResult.data as ClubRow | null;
      const stadiumValue = row?.stadiums;
      const stadium = Array.isArray(stadiumValue) ? (stadiumValue[0] ?? null) : stadiumValue;
      return {
        description: row?.description ?? null,
        founded: row?.founded ?? null,
        city: row?.city ?? null,
        source: row?.data_source ?? null,
        updatedAt: row?.data_updated_at ?? null,
        stadium: stadium
          ? {
              name: stadium.name,
              city: stadium.city,
              capacity: stadium.capacity,
              photoUrl: stadium.photo_url,
            }
          : null,
        honours: (honoursResult.data ?? []).map((honour) => ({
          id: honour.id,
          competition: honour.competition,
          titleCount: honour.title_count,
          seasons: honour.seasons,
          source: honour.source,
        })),
      };
    },
  });
}