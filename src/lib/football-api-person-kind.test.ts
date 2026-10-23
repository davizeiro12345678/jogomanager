import { afterEach, describe, expect, it, vi } from "vitest";
import { sdbSquad, footballDataSquad } from "./football-api.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("provider squad roles", () => {
  it("excludes SportsDB staff before fallback mapping while retaining player source IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            player: [
              { idPlayer: "coach", strPlayer: "Mesmo Nome", strPosition: "Manager" },
              { idPlayer: "assistant", strPlayer: "Mesmo Nome", strPosition: "Goalkeeper Coach" },
              { idPlayer: "player", strPlayer: "Mesmo Nome", strPosition: "Midfielder" },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const rows = await sdbSquad("42");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      externalId: "player",
      sourceKind: "player",
      rawPosition: "Midfielder",
      position: "MF",
    });
  });
  it("excludes football-data staff using the same admission policy", async () => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "fixture-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            squad: [
              { id: 1, name: "Pessoa", position: "Coach" },
              { id: 2, name: "Pessoa", position: "Forward" },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    expect(await footballDataSquad("42")).toEqual([
      expect.objectContaining({ externalId: "2", sourceKind: "player", position: "FW" }),
    ]);
  });
});
