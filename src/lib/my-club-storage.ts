import { scopedKey } from "./world-scope";
import type { MyClub } from "./myClub";
import { parseImportJson, record, safeRecordId, textField } from "./import-validation";

/** Reading a club identity must not initialize the mutable game catalogue. */
export function readMyClub(): Pick<MyClub, "id" | "name"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scopedKey("manager3d.myclub.v1"));
    if (!raw) return null;
    const identity = parseImportJson(raw);
    if (
      !record(identity) ||
      !safeRecordId(identity["id"]) ||
      !identity["id"].startsWith("my-") ||
      !textField(identity["name"]) ||
      !identity["name"].trim()
    )
      return null;
    // This lightweight reader only supplies a display identity. Applying a club
    // to the world still goes through the complete importClubPack validation.
    return { id: identity["id"], name: identity["name"] };
  } catch {
    return null;
  }
}
