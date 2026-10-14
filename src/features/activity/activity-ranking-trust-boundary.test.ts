import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20261004003948_activity_ranking_trust_boundary.sql",
    import.meta.url,
  ),
  "utf8",
);

function migrationFunctionBody(name: string) {
  return new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?AS \\$function\\$([\\s\\S]*?)\\$function\\$`,
    "i",
  ).exec(migration)?.[1];
}

describe("activity ranking trust boundary", () => {
  it("does not submit client career totals to the activity heartbeat RPC", () => {
    const source = readFileSync(new URL("./ActivityRanking.tsx", import.meta.url), "utf8");
    const rpcPayload = source.match(/supabase\.rpc\("record_active_time",\s*\{([\s\S]*?)\}\s*\)/);

    expect(rpcPayload).not.toBeNull();
    expect(rpcPayload?.[1]).not.toMatch(/p_(?:matches_started|matches_completed|wins|seasons)\b/);
  });

  it("does not persist client-submitted career totals in the database", () => {
    const body = migrationFunctionBody("record_active_time");

    expect(body).toBeDefined();
    expect(body ?? "").not.toMatch(
      /\b(?:p_matches_started|p_matches_completed|p_wins|p_seasons|matches_started|matches_completed|wins|seasons)\b/i,
    );
  });

  it("does not rank opted-in users by untrusted match or win totals", () => {
    const publicRanking = migrationFunctionBody("get_public_activity_rankings");
    const ownRanking = migrationFunctionBody("get_own_activity_ranking");

    expect(publicRanking).toBeDefined();
    expect(ownRanking).toBeDefined();
    expect(publicRanking ?? "").toMatch(
      /0::integer\s+AS\s+matches_completed\s*,\s*0::integer\s+AS\s+wins/i,
    );
    expect(ownRanking ?? "").toMatch(
      /0::integer\s+AS\s+matches_completed\s*,\s*0::integer\s+AS\s+wins/i,
    );
    const orderByClauses = [...(publicRanking ?? "").matchAll(/\bORDER BY\s+([^\n;)]+)/gi)];
    expect(orderByClauses.length).toBeGreaterThan(0);
    expect(orderByClauses.map((clause) => clause[1]).join(" ")).not.toMatch(
      /\b(?:matches_completed|wins)\b/i,
    );
  });
});
