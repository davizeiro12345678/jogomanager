import { athleteSlot, athletePanelSearch as parsePanel } from "./athlete-search";

// Route validators are eager. Preserve the parser interface and URL contract
// without making every route download a schema engine for two small checks.
function searchRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new TypeError("Parâmetros de busca inválidos");
  return input as Record<string, unknown>;
}

function validator<T>(parse: (input: unknown) => T) {
  return {
    parse,
    safeParse(input: unknown) {
      try {
        return { success: true as const, data: parse(input) };
      } catch (error) {
        return { success: false as const, error };
      }
    },
  };
}

export const createAthleteSearch = validator((input) => ({
  slot: athleteSlot(searchRecord(input)),
}));
export const athletePanelSearch = validator((input) => parsePanel(searchRecord(input)));
