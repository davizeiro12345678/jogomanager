/** Match player IDs reserve five characters for the generated transfer prefix. */
export const MAX_TRANSFER_KEY_LENGTH = 155;
export const MAX_GENERATED_MARKET_ENTRIES = 128;
export const MAX_PREMIUM_SCOUT_REPORTS = 40;

export function validTransferText(value: unknown, max: number): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) return false;
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) < 32) return false;
  }
  return true;
}

/** Reject invalid work requests before any seeded loop or player construction. */
export function validWorkCount(value: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}
