import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deployed heartbeat trust boundary", () => {
  it("keeps legacy counters out of all heartbeat writes", () => {
    const sql = readFileSync(
      new URL(
        "../../../drizzle/migrations/0048_activity_heartbeat_ignores_client_scores.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const body = sql.split("AS $function$")[1]?.split("$function$;")[0];
    expect(body).toBeDefined();
    expect(body).not.toMatch(
      /\b(?:p_wins|p_matches_started|p_matches_completed|p_seasons|wins|matches_started|matches_completed|seasons)\b/,
    );
    expect(sql).toContain("FROM PUBLIC, anon");
  });
});
