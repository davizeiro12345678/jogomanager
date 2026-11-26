import type { Club } from "./types";

const PLACEHOLDER_NAMES = new Set([
  "clube",
  "club",
  "clube convidado",
  "unknown club",
  "unnamed club",
  "sem nome",
]);

function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/**
 * Resolve each league entry against the canonical club map before exposing it
 * to quick-match selection. Missing IDs and generic fallback labels are not
 * playable identities and must never reach buildTeamSetup/safeClub.
 */
export function selectableQuickMatchClubs(
  leagueClubs: readonly Club[],
  canonicalClubs: Readonly<Record<string, Club>>,
): Club[] {
  const seen = new Set<string>();
  const resolved: Club[] = [];

  for (const entry of leagueClubs) {
    const club = canonicalClubs[entry.id];
    if (!club || club.id !== entry.id || seen.has(club.id)) continue;
    if (!club.name.trim() || PLACEHOLDER_NAMES.has(normalizedName(club.name))) continue;
    seen.add(club.id);
    resolved.push(club);
  }

  return resolved;
}

function randomIndex(length: number, random: () => number) {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(value * length)));
}

/** Returns two different canonical clubs, or null when the league is invalid. */
export function randomQuickMatchPair(
  clubs: readonly Club[],
  random: () => number = Math.random,
): { home: Club; away: Club } | null {
  if (clubs.length < 2) return null;
  const homeIndex = randomIndex(clubs.length, random);
  let awayIndex = randomIndex(clubs.length, random);
  if (awayIndex === homeIndex) awayIndex = (homeIndex + 1) % clubs.length;
  const home = clubs[homeIndex];
  const away = clubs[awayIndex];
  return home && away && home.id !== away.id ? { home, away } : null;
}
