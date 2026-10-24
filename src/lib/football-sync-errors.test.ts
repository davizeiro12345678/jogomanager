import { describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "import_runs") {
        return {
          upsert: async () => ({ error: { message: "SQL private.internal_competition rejected" } }),
        };
      }
      const chain = {
        insert: () => chain,
        select: () => chain,
        maybeSingle: async () => ({ data: { id: "run_fixture" } }),
        update: (value: unknown) => {
          deps.update(value);
          return chain;
        },
        eq: async () => ({ error: null }),
      };
      return chain;
    },
  },
}));
import { runSync } from "./football-sync.server";

describe("scheduled football sync error response", () => {
  it("returns and persists only a stable failure code", async () => {
    expect(await runSync({ scope: "seed" })).toEqual({
      ok: false,
      scope: "seed",
      error: "Football sync failed",
    });
    expect(deps.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        error: "sync_failed",
      }),
    );
    expect(JSON.stringify(deps.update.mock.calls)).not.toContain("private.internal_competition");
  });
});
