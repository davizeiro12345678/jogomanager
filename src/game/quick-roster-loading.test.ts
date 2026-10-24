import { afterEach, describe, expect, it, vi } from "vitest";
const source = vi.hoisted(() => ({ rows: [] as unknown[], calls: [] as string[], hang: false }));
vi.mock("@/lib/football.functions", () => ({
  getRealSquad: async ({ data }: { data: { clubId: string } }) => {
    source.calls.push(data.clubId);
    if (source.hang) return new Promise<unknown[]>(() => undefined);
    return source.rows;
  },
}));
import { prepareQuickMatchRosters } from "./quick-roster-loading";
import { realSquadFor } from "@/lib/realSquads";
afterEach(() => {
  source.hang = false;
  vi.useRealTimers();
});

describe("shared roster preparation", () => {
  it("loads both public club rosters before match construction", async () => {
    source.rows = [
      {
        id: "roster-player-42",
        name: "Atleta de teste",
        position: "GK",
        age: 28,
        overall: 70,
        shirt_number: 1,
        nationality: "Brasil",
        photo_url: null,
      },
    ];
    await prepareQuickMatchRosters("roster-home", "roster-away");
    expect(source.calls).toEqual(["roster-home", "roster-away"]);
    expect(realSquadFor("roster-home")[0]?.name).toBe("Atleta de teste");
    expect(realSquadFor("roster-away")[0]?.name).toBe("Atleta de teste");
  });
  it("lets the match use the existing offline fallback if the optional provider stalls", async () => {
    vi.useFakeTimers();
    source.hang = true;
    let ready = false;
    const preparation = prepareQuickMatchRosters("slow-home", "slow-away").then(() => {
      ready = true;
    });
    await vi.advanceTimersByTimeAsync(8000);
    expect(ready).toBe(true);
    await preparation;
  });
});
