import * as z from "zod/mini";

// Route search validators are eager even when their page components are lazy.
// Keep the same bounded, non-coercing schema without importing classic Zod's
// form helpers and JSON-schema generation into every public page.
const slot = z.catch(z.int().check(z.minimum(1), z.maximum(3)), 1);

export const createAthleteSearch = z.object({ slot });
export const athletePanelSearch = z.object({
  slot,
  tab: z.optional(
    z.enum([
      "semana",
      "calendario",
      "saude",
      "atributos",
      "selecao",
      "contrato",
      "noticias",
      "historico",
    ]),
  ),
});
