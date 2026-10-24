export interface MarketSearchFields {
  q?: string;
  pos?: string;
  clubId?: string;
  page?: number;
  minAge?: number;
  maxAge?: number;
  minOvr?: number;
  maxOvr?: number;
}

function containsControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function normalizeMarketSearch(input: unknown): MarketSearchFields {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Consulta de jogadores inválida.");
  const value = input as Record<string, unknown>;
  const out: MarketSearchFields = {};
  for (const key of ["q", "pos", "clubId"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "string") throw new Error("Filtro de jogadores inválido.");
    if (containsControlCharacter(value[key])) throw new Error("Filtro de jogadores inválido.");
    const text = value[key].normalize("NFKC").trim();
    if (text.length > (key === "q" ? 80 : 160) || containsControlCharacter(text))
      throw new Error("Filtro de jogadores inválido.");
    if (text && !(key === "pos" && text === "ALL")) out[key] = text;
  }
  for (const key of ["page", "minAge", "maxAge", "minOvr", "maxOvr"] as const) {
    if (value[key] === undefined) continue;
    const number = value[key];
    const max = key === "page" ? 10_000 : 100;
    if (
      typeof number !== "number" ||
      !Number.isFinite(number) ||
      !Number.isInteger(number) ||
      number < 0 ||
      number > max
    )
      throw new Error("Intervalo de jogadores inválido.");
    out[key] = number;
  }
  if ((out.minAge ?? 0) > (out.maxAge ?? 100) || (out.minOvr ?? 0) > (out.maxOvr ?? 100))
    throw new Error("Intervalo de jogadores inválido.");
  out.page ??= 0;
  return out;
}
/** Literal substring search: user '%' and '_' must not become unbounded
 * wildcards. PostgREST still binds/encodes the entire value as a parameter. */
export function marketNamePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
