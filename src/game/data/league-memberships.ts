import type { Club, League } from "../types";
import { LEAGUE_MEMBERSHIPS, CATALOG_ALIASES } from "./league-memberships.generated";

export { CATALOG_ALIASES };
export function applyMembership(league: League, registry: Record<string, Club>): League {
  const snapshot = LEAGUE_MEMBERSHIPS[league.id];
  if (!snapshot) return { ...league, catalogStatus: "legacy" };
  const [sourceUrl, season, clubRows, displayName] = snapshot;
  const strength = Math.round(
    league.clubs.reduce((s, c) => s + c.strength, 0) / Math.max(1, league.clubs.length),
  );
  return {
    ...league,
    ...(displayName ? { name: displayName } : {}),
    membershipSeason: season,
    membershipSource: sourceUrl.startsWith("sdb:")
      ? `https://www.thesportsdb.com/league/${sourceUrl.slice(4)}`
      : sourceUrl,
    catalogStatus: "sourced",
    clubs: clubRows.split(";").map((row) => {
      const [id = "", label, source] = row.split("|");
      const name = label || registry[id]?.name || "Clube";
      const sourceTeamId = source || id.match(/_(\d{5,})$/)?.[1];
      return {
        ...(registry[id] ?? {
          id,
          name,
          short: name
            .replace(/[^\p{L}\p{N}]/gu, "")
            .slice(0, 3)
            .toUpperCase(),
          primary: "#1f4fa0",
          secondary: "#ffffff",
          strength: Math.max(40, Math.min(80, strength)),
        }),
        league: league.id,
        ...(sourceTeamId ? { sourceTeamId } : {}),
      };
    }),
  };
}
