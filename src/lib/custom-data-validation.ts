import type { CustomData } from "./customData";
import {
  boundedNumber,
  colorField,
  imageField,
  record,
  safeRecordId,
  textField,
  validStyles,
} from "./import-validation";

export function validCustomData(value: unknown): value is CustomData {
  if (!record(value)) return false;
  // A career envelope has none of these collections. Never turn a different
  // backup format (or an arbitrary JSON object) into an empty editor package.
  if (!["clubs", "players", "competitions"].some((key) => Object.hasOwn(value, key))) return false;
  if (
    value["clubs"] !== undefined &&
    (!record(value["clubs"]) || Object.keys(value["clubs"]).length > 5000)
  )
    return false;
  if (
    value["players"] !== undefined &&
    (!Array.isArray(value["players"]) || value["players"].length > 20_000)
  )
    return false;
  if (
    value["competitions"] !== undefined &&
    (!Array.isArray(value["competitions"]) || value["competitions"].length > 500)
  )
    return false;
  for (const [id, club] of Object.entries(value["clubs"] ?? {})) {
    if (
      !safeRecordId(id) ||
      !record(club) ||
      club["id"] !== id ||
      !safeRecordId(club["id"]) ||
      !textField(club["name"]) ||
      !textField(club["short"], 8) ||
      !colorField(club["primary"]) ||
      !colorField(club["secondary"]) ||
      !imageField(club["badge"]) ||
      !validStyles(club) ||
      (club["force"] !== undefined && !boundedNumber(club["force"], 35, 99))
    )
      return false;
  }
  const ids = new Set<string>();
  for (const player of (value["players"] ?? []) as unknown[]) {
    if (
      !record(player) ||
      !safeRecordId(player["id"]) ||
      ids.has(player["id"]) ||
      !safeRecordId(player["clubId"]) ||
      !textField(player["name"]) ||
      !player["name"].trim() ||
      !["GK", "DF", "MF", "FW"].includes(String(player["pos"])) ||
      !boundedNumber(player["age"], 14, 60) ||
      !boundedNumber(player["ovr"], 0, 99) ||
      !boundedNumber(player["contractYears"], 0, 20) ||
      !boundedNumber(player["wage"], 0, 1_000_000) ||
      !boundedNumber(player["value"], 0, 1_000_000) ||
      !imageField(player["photo"])
    )
      return false;
    for (const attribute of ["potential", "pace", "shooting", "passing", "defending", "physical"])
      if (player[attribute] !== undefined && !boundedNumber(player[attribute], 0, 99)) return false;
    if (
      player["number"] !== undefined &&
      (!boundedNumber(player["number"], 1, 99) || !Number.isInteger(player["number"]))
    )
      return false;
    ids.add(player["id"]);
  }
  for (const competition of (value["competitions"] ?? []) as unknown[]) {
    if (
      !record(competition) ||
      !safeRecordId(competition["id"]) ||
      !textField(competition["name"]) ||
      !textField(competition["country"]) ||
      !Array.isArray(competition["clubIds"]) ||
      competition["clubIds"].length > 200 ||
      !competition["clubIds"].every(safeRecordId) ||
      new Set(competition["clubIds"]).size !== competition["clubIds"].length ||
      !["pontos-corridos", "mata-mata", "grupos-mata-mata"].includes(
        String(competition["format"]),
      ) ||
      !boundedNumber(competition["relegated"], 0, competition["clubIds"].length) ||
      !boundedNumber(competition["continentalSlots"], 0, competition["clubIds"].length)
    )
      return false;
  }
  return true;
}
