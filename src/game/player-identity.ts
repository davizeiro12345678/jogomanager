import type { CareerState, Player } from "./types";

export const identityText = (value: unknown): string => typeof value === "string" ? value.trim() : "";
export const providerName = (value: unknown): string => identityText(value).toLowerCase();
export const normalizedPlayerName = (value: unknown): string => identityText(value)
  .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function validBirthDate(value: unknown): string {
  const text = identityText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const time = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === text ? text : "";
}

/** An exact birth date and full name in the same registration context, never name alone. */
export function verifiedPersonKey(name: unknown, birth: unknown, club: string): string {
  const fullName = normalizedPlayerName(name);
  const date = validBirthDate(birth);
  return date && fullName.includes(" ") && club ? `person:${club}:${fullName}:${date}` : "";
}

export function playerSourceKeys(player: Pick<Player, "id"> & Partial<Player>): string[] {
  const keys = new Set<string>();
  const record = identityText(player.sourcePlayerId);
  if (record) keys.add(`record:${record}`);
  // Saves created before provenance was recorded still have this unambiguous prefix.
  if (player.id.startsWith("real-") && player.rosterSource !== "custom") keys.add(`record:${player.id.slice(5)}`);
  const source = providerName(player.sourceProvider);
  const external = identityText(player.sourceExternalId);
  if (source && external) keys.add(`provider:${source}:${external}`);
  const aliases = Array.isArray(player.sourceIdentityAliases) ? player.sourceIdentityAliases : [];
  for (const alias of aliases) if (typeof alias === "string" && /^(record|provider):/.test(alias)) keys.add(alias);
  return [...keys];
}

export interface RealPlayerIdentity {
  id: string;
  source?: string | null;
  source_id?: string | null;
  birth_date?: string | null;
  name: string;
  clubId: string;
  identity_aliases?: string[];
}

export function realPlayerKeys(target: RealPlayerIdentity): string[] {
  const keys = [`record:${identityText(target.id)}`];
  const source = providerName(target.source);
  const external = identityText(target.source_id);
  if (source && external) keys.push(`provider:${source}:${external}`);
  const aliases = Array.isArray(target.identity_aliases) ? target.identity_aliases : [];
  keys.push(...aliases.filter(k => typeof k === "string" && /^(record|provider):/.test(k)));
  return keys;
}

/** Includes imported registrations and legacy purchases, not just the transfer-history list. */
export function ownsRealPlayer(state: CareerState, target: RealPlayerIdentity): boolean {
  const keys = new Set(realPlayerKeys(target));
  const person = verifiedPersonKey(target.name, target.birth_date, state.clubId);
  return Object.values(state.players).some(player => player.clubId === state.clubId && (
    playerSourceKeys(player).some(key => keys.has(key)) ||
    (player.rosterSource === "imported" && !!person && person === verifiedPersonKey(player.name, player.birthDate, player.clubId))
  ));
}
