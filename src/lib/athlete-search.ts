/** Route search is eager: keep these small checks independent of form schemas. */
export function athleteSlot(search: Record<string, unknown>): number {
  const value = search["slot"];
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3
    ? value
    : 1;
}

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

export function athletePanelSearch(search: Record<string, unknown>): {
  slot: number;
  tab?: AthleteTab;
} {
  const tab = search["tab"];
  if (tab === undefined) return { slot: athleteSlot(search) };
  if (typeof tab !== "string" || !(ATHLETE_TABS as readonly string[]).includes(tab))
    throw new Error("Aba do atleta inválida");
  return { slot: athleteSlot(search), tab: tab as AthleteTab };
}
