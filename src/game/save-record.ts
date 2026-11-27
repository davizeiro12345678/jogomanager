/** Persist keyed data as an ordinary JSON dictionary without inherited names. */
export function nullPrototypeRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  const record = Object.fromEntries(entries);
  Object.setPrototypeOf(record, null);
  return record;
}
