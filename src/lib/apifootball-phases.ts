/** Shared scheduling contract. Provider payloads and credentials stay server-side. */
import { catalogImageUrl } from "./catalog-media";
export const API_FOOTBALL_PHASES = [
  "leagues",
  "teams",
  "squads",
  "fixtures",
  "standings",
  "predictions",
  "odds",
  "stats",
  "countries",
  "timezones",
  "venues",
  "coaches",
  "injuries",
  "teamstats",
  "details",
  "playerprofiles",
  "playerseasons",
  "transfers",
  "trophies",
  "sidelined",
  "topscorers",
  "topassists",
  "topyellowcards",
  "topredcards",
  "fixtureevents",
  "fixturelineups",
  "fixturestatistics",
  "fixtureplayers",
] as const;

export type Phase = (typeof API_FOOTBALL_PHASES)[number];
export const isApiFootballPhase = (value: unknown): value is Phase =>
  typeof value === "string" && API_FOOTBALL_PHASES.some((phase) => phase === value);

export const LEADER_ENDPOINTS = {
  topscorers: "/players/topscorers",
  topassists: "/players/topassists",
  topyellowcards: "/players/topyellowcards",
  topredcards: "/players/topredcards",
} as const;
export const FIXTURE_ENDPOINTS = {
  fixtureevents: "/fixtures/events",
  fixturelineups: "/fixtures/lineups",
  fixturestatistics: "/fixtures/statistics",
  fixtureplayers: "/fixtures/players",
} as const;

/** IDs are provider identities, never positions in a response array. */
export function apiFootballPlayerId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { player?: { id?: unknown }; id?: unknown };
  const id = row.player?.id ?? row.id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

export function apiFootballProfileProjection(value: unknown) {
  const id = apiFootballPlayerId(value);
  if (!id || !value || typeof value !== "object") return null;
  const record = value as { player?: unknown };
  const player = (record.player && typeof record.player === "object" ? record.player : value) as {
    birth?: { date?: unknown };
    photo?: unknown;
    nationality?: unknown;
  };
  const rawDate = player.birth?.date;
  const date =
    typeof rawDate === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawDate)
      ? new Date(`${rawDate}T00:00:00Z`)
      : null;
  const birth =
    date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === rawDate
      ? rawDate
      : null;
  return {
    source_id: id,
    birth_date: birth,
    photo_url: catalogImageUrl(player.photo) ?? null,
    nationality:
      typeof player.nationality === "string"
        ? player.nationality.trim().slice(0, 100) || null
        : null,
  };
}

export const isFootballStaffRole = (role: string | undefined) =>
  /coach|manager|assistant|trainer|staff|physio|technical|treinador|técnico|comissão/i.test(
    role ?? "",
  );
