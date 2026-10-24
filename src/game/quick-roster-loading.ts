import { loadRealSquad } from "@/lib/realSquads";

/** Use the same cached provider registrations as new careers, with offline fallback. */
export async function prepareQuickMatchRosters(home: string, away: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([...new Set([home, away])].map((club) => loadRealSquad(club))),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 8000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
