import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrations = new URL("../../drizzle/migrations/", import.meta.url);
// These retained drafts are superseded by 0023_multiplayer_server_authority.
// Replaying the older private-seed policy would widen grants and break replay.
const SUPERSEDED_DRAFTS = new Set([
  "0018_server_managed_multiplayer_rooms.sql",
  "0019_private_multiplayer_seeds.sql",
]);

describe("application migration manifest", () => {
  it("registers every SQL file once and in strictly increasing application order", async () => {
    const sqlFiles = (await readdir(migrations))
      .filter((name) => /^\d{4}_.*\.sql$/.test(name) && !SUPERSEDED_DRAFTS.has(name))
      .sort();
    const journal = JSON.parse(
      await readFile(new URL("meta/_journal.json", migrations), "utf8"),
    ) as {
      entries: Array<{ idx: number; when: number; tag: string }>;
    };
    expect(journal.entries.map((entry) => `${entry.tag}.sql`)).toEqual(sqlFiles);
    for (let index = 0; index < journal.entries.length; index += 1) {
      const entry = journal.entries[index]!;
      expect(entry.idx).toBe(Number(entry.tag.slice(0, 4)));
      expect(Number.isSafeInteger(entry.when)).toBe(true);
      if (index > 0) expect(entry.when).toBeGreaterThan(journal.entries[index - 1]!.when);
    }
  });
});
