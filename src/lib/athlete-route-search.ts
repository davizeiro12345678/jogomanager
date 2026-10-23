// These two URL fields are eager even when their pages are lazy. Their bounded
// parser needs no schema library in every public page. Server mutation schemas
// remain unchanged; this only validates navigation, never authorization.
const TABS = [
  "semana",
  "calendario",
  "saude",
  "atributos",
  "selecao",
  "contrato",
  "noticias",
  "historico",
] as const;
type AthletePanelTab = (typeof TABS)[number];

function searchObject(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Parâmetros de navegação inválidos");
  }
  return input as Record<string, unknown>;
}

function parseSlot(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3
    ? value
    : 1;
}

export function createAthleteSearch(input: unknown): { slot: number } {
  return { slot: parseSlot(searchObject(input)["slot"]) };
}

export function athletePanelSearch(input: unknown): {
  slot: number;
  tab?: AthletePanelTab | undefined;
} {
  const search = searchObject(input);
  const tab = search["tab"];
  if (tab !== undefined && !(TABS as readonly unknown[]).includes(tab)) {
    throw new TypeError("Aba do atleta inválida");
  }
  const result: { slot: number; tab?: AthletePanelTab | undefined } = {
    slot: parseSlot(search["slot"]),
  };
  if ("tab" in search) result.tab = tab as AthletePanelTab | undefined;
  return result;
}
