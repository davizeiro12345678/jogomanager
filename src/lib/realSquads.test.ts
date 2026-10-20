import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getRealSquad } = vi.hoisted(() => ({ getRealSquad: vi.fn() }));
vi.mock("./football.functions", () => ({ getRealSquad }));

const player = {
  id: "player-1",
  name: "Jogador Um",
  position: "FW",
  age: 24,
  shirt_number: 9,
  nationality: "Brazil",
  overall: 75,
  photo_url: "https://images.example/player.png",
};
let squads: typeof import("./realSquads");
let stored: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  getRealSquad.mockReset();
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  squads = await import("./realSquads");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("real squad client cache", () => {
  it("deduplicates concurrent selections and preserves the loaded real identity offline", async () => {
    let resolve!: (value: unknown[]) => void;
    getRealSquad.mockImplementation(
      () =>
        new Promise<unknown[]>((done) => {
          resolve = done;
        }),
    );
    const reads = Array.from({ length: 20 }, () => squads.loadRealSquad("club"));
    expect(getRealSquad).toHaveBeenCalledTimes(1);
    resolve([player]);
    const results = await Promise.all(reads);
    expect(results.every((rows) => rows[0]?.id === "player-1")).toBe(true);
    expect(squads.realSquadFor("club")[0]?.name).toBe("Jogador Um");
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).toHaveBeenCalledTimes(1);
    expect(stored.get("manager3d.realsquads.v3")).toContain("player-1");
  });

  it("reuses a successful empty result briefly and then checks for newly imported players", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    getRealSquad.mockResolvedValueOnce([]).mockResolvedValue([player]);
    expect(await squads.loadRealSquad("club")).toEqual([]);
    expect(await squads.loadRealSquad("club")).toEqual([]);
    expect(getRealSquad).toHaveBeenCalledTimes(1);
    now += 60_001;
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).toHaveBeenCalledTimes(2);
  });

  it("allows an immediate retry after a failed request instead of treating it as an empty import", async () => {
    getRealSquad.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([player]);
    expect(await squads.loadRealSquad("club")).toEqual([]);
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).toHaveBeenCalledTimes(2);
  });

  it("keeps a loaded squad usable when persistent browser storage is full", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });
    getRealSquad.mockResolvedValue([player]);
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).toHaveBeenCalledTimes(1);
  });

  it("refreshes a potentially truncated legacy squad while retaining stable real IDs", async () => {
    stored.set("manager3d.realsquads.v2", JSON.stringify({ club: [player] }));
    const second = { ...player, id: "player-2", name: "Jogador Dois" };
    getRealSquad.mockResolvedValue([player, second]);
    expect(squads.realSquadFor("club")[0]?.id).toBe("player-1");
    const reads = await Promise.all(Array.from({ length: 20 }, () => squads.loadRealSquad("club")));
    expect(reads.every((rows) => rows.length === 2)).toBe(true);
    expect(getRealSquad).toHaveBeenCalledTimes(1);
    expect(squads.realSquadFor("club").map((row) => row.id)).toEqual(["player-1", "player-2"]);
    expect(JSON.parse(stored.get("manager3d.realsquads.v3")!).club).toMatchObject({
      rows: [{ id: "player-1" }, { id: "player-2" }],
      at: expect.any(Number),
    });
    expect(stored.get("manager3d.realsquads.v2")).toContain("player-1");
  });

  it("retains the legacy real names when revalidation fails offline and allows retry", async () => {
    stored.set("manager3d.realsquads.v2", JSON.stringify({ club: [player] }));
    getRealSquad.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([player]);
    expect((await squads.loadRealSquad("club"))[0]?.name).toBe("Jogador Um");
    expect(stored.has("manager3d.realsquads.v3")).toBe(false);
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).toHaveBeenCalledTimes(2);
  });

  it("revalidates a positive squad after 24 hours without replacing names on failed or empty reads", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    stored.set("manager3d.realsquads.v3", JSON.stringify({ club: { rows: [player], at: now } }));
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).not.toHaveBeenCalled();
    now += 24 * 60 * 60 * 1_000 + 1;
    getRealSquad.mockResolvedValue([]);
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
    expect(getRealSquad).toHaveBeenCalledTimes(1);
    now += 60_001;
    getRealSquad.mockResolvedValue([player, { ...player, id: "player-2", name: "Jogador Dois" }]);
    expect(await squads.loadRealSquad("club")).toHaveLength(2);
    expect(getRealSquad).toHaveBeenCalledTimes(2);
  });

  it("discards malformed v3 timestamps and still recovers the legacy identity", async () => {
    stored.set(
      "manager3d.realsquads.v3",
      JSON.stringify({ club: { rows: [player], at: "invalid" } }),
    );
    stored.set("manager3d.realsquads.v2", JSON.stringify({ club: [player] }));
    getRealSquad.mockRejectedValue(new Error("offline"));
    expect((await squads.loadRealSquad("club"))[0]?.id).toBe("player-1");
  });
});
