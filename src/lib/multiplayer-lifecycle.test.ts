import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  owner: "host",
  closed: false,
  updates: 0,
  deletedSeeds: 0,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown) => value;
    const builder = {
      middleware: () => builder,
      validator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: unknown) => Promise<unknown>) => (args: { data: unknown; context: unknown }) =>
          fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      let updating = false;
      const result = () => ({
        error: null,
        data: updating
          ? db.closed
            ? { id: "room" }
            : null
          : { id: "room", host_id: db.owner, guest_id: null, status: "open" },
      });
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: () => {
          updating = true;
          db.updates++;
          return chain;
        },
        delete: () => {
          if (table === "match_room_secrets") db.deletedSeeds++;
          return chain;
        },
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
  },
}));
import { leaveMatchRoom, finishMatchRoom } from "./multiplayer.functions";
const roomId = "00000000-0000-4000-8000-000000000001";
type Handler = (args: { data: unknown; context: { userId: string } }) => Promise<unknown>;
const leave = leaveMatchRoom as unknown as Handler;
beforeEach(() => {
  db.owner = "host";
  db.closed = false;
  db.updates = 0;
  db.deletedSeeds = 0;
});

describe("competitive room lifecycle", () => {
  it("keeps the private seed when a concurrent join prevents the close", async () => {
    expect(await leave({ data: { roomId }, context: { userId: "host" } })).toEqual({
      ok: false,
      reason: "leave_failed",
    });
    expect(db.deletedSeeds).toBe(0);
  });
  it("cleans up the seed only after its own compare-and-set closes the room", async () => {
    db.closed = true;
    expect(await leave({ data: { roomId }, context: { userId: "host" } })).toEqual({ ok: true });
    expect(db.deletedSeeds).toBe(1);
  });
  it("does not let another player close a room", async () => {
    expect(await leave({ data: { roomId }, context: { userId: "stranger" } })).toEqual({
      ok: false,
      reason: "not_participant",
    });
    expect(db.updates).toBe(0);
    expect(db.deletedSeeds).toBe(0);
  });
  it("rejects a forged final-score request from a non-host before touching private state", async () => {
    const finish = finishMatchRoom as unknown as Handler;
    expect(
      await finish({
        data: { roomId, homeGoals: 999, awayGoals: 0 },
        context: { userId: "stranger" },
      }),
    ).toEqual({ ok: false, reason: "not_participant" });
    expect(db.updates).toBe(0);
    expect(db.deletedSeeds).toBe(0);
  });
});
