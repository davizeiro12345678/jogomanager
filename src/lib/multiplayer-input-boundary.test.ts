import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), from: vi.fn() }));
vi.mock("@/game/data/leagues", () => ({ CLUBS: { br_fla: {} } }));
vi.mock("@/game/quickMatch", () => ({ buildTeamSetup: vi.fn() }));
vi.mock("@/game/sim", () => ({
  LIVE_MATCH_CLOCK_SCALE: 1,
  MATCH_SIMULATION_STEP: 0.05,
  MATCH_SIMULATION_TICK_LIMIT: 1,
  MatchSim: class {},
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("./multiplayer-room-create.server", () => ({ createPrivateMatchRoom: mocks.create }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse = (input: unknown): unknown => input;
    const builder = {
      middleware: () => builder,
      validator: (next: (input: unknown) => unknown) => {
        parse = next;
        return builder;
      },
      handler:
        (handler: (args: { data: unknown; context: { userId: string } }) => unknown) =>
        async (args: { data: unknown }) =>
          handler({ data: parse(args.data), context: { userId: "verified-host" } }),
    };
    return builder;
  },
}));
import { createMatchRoom, joinMatchRoom } from "./multiplayer.functions";
const create = createMatchRoom as unknown as (args: { data: unknown }) => Promise<unknown>;
const join = joinMatchRoom as unknown as (args: { data: unknown }) => Promise<unknown>;
beforeEach(() => vi.clearAllMocks());

describe("multiplayer client input authority", () => {
  it.each(["constructor", "__proto__", "toString"])(
    "rejects inherited club property %s before any database access",
    async (club) => {
      expect(await create({ data: { hostClub: club } })).toEqual({
        ok: false,
        reason: "invalid_club",
      });
      expect(
        await join({ data: { roomId: "8534946c-d202-4b0b-a2ce-f39b35c181e3", guestClub: club } }),
      ).toEqual({ ok: false, reason: "invalid_club" });
      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("rejects client host identity and simulation seeds before calling the server RPC", async () => {
    await expect(
      create({ data: { hostClub: "br_fla", hostId: "forged", seed: "chosen-by-browser" } }),
    ).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("passes only the authenticated host to the atomic room creator", async () => {
    mocks.create.mockResolvedValue({ ok: false, reason: "too_many_rooms" });
    expect(await create({ data: { hostClub: "br_fla" } })).toEqual({
      ok: false,
      reason: "too_many_rooms",
    });
    expect(mocks.create).toHaveBeenCalledWith(expect.any(Object), "verified-host", "br_fla");
  });
});
