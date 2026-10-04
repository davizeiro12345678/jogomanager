import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261004120000_lock_purchase_history_server_only.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("purchase history write boundary migration", () => {
  it("removes client-created purchase rows while preserving trusted fulfillment", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Users create own purchases"');
    expect(migration).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE\s+ON TABLE public\.user_purchases FROM anon, authenticated/i,
    );
    expect(migration).toMatch(/GRANT SELECT ON TABLE public\.user_purchases TO authenticated/i);
    expect(migration).toMatch(/GRANT ALL ON TABLE public\.user_purchases TO service_role/i);
  });
});
