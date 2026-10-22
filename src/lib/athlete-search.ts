// Route search validators are part of the shared router entry. Keep these
// primitive checks independent of save/body schemas and their Zod dependency.
const ATHLETE_TABS = [
  "semana",
  "calendario",
  "saude",
  "atributos",
  "selecao",
  "contrato",
  "noticias",
  "historico",
] as const;

type AthleteTab = (typeof ATHLETE_TABS)[number];

export function athleteSlotSearch(search: Record<string, unknown>): { slot: number } {
  const slot = search["slot"];
  return {
    slot: typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= 3 ? slot : 1,
  };
}

export function athletePanelSearch(search: Record<string, unknown>): {
  slot: number;
  tab?: AthleteTab;
} {
  const slot = athleteSlotSearch(search);
  const tab = search["tab"];
  if (tab === undefined) return slot;
  if (typeof tab !== "string" || !(ATHLETE_TABS as readonly string[]).includes(tab))
    throw new TypeError("Invalid athlete panel tab");
  return { ...slot, tab: tab as AthleteTab };
}
