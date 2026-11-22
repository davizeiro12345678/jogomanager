/**
 * Avoid loading offline storage/IndexedDB code for a first-time visitor.
 * These keys are the exact guest keys read by readLocalCareer() in
 * lib/offline/store.ts. When storage access is denied, fail open: preserve the
 * previous resume behavior instead of silently hiding a possible save.
 */
type LocalStorageReader = Pick<Storage, "getItem">;

const CURRENT_GUEST_CAREER = "manager3d.career.v2.guest";
const LEGACY_GUEST_CAREER = "manager3d.career.v1";

export function shouldLoadHomeCareer(getStorage: () => LocalStorageReader): boolean {
  try {
    const storage = getStorage();
    return (
      storage.getItem(CURRENT_GUEST_CAREER) !== null ||
      storage.getItem(LEGACY_GUEST_CAREER) !== null
    );
  } catch {
    return true;
  }
}
