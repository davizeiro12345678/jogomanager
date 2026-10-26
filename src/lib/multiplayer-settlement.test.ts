import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  room: {} as Record<string, unknown>,
  seedReads: 0,
  seedDeletes: 0,
  simulations: 0,
  failReplay: false,
  supersede: false,
  gate: undefined as Promise<void> | undefined,
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
vi.mock("./match-aux-client.server", () => ({
  matchAuxEnabled: () => true,
  simulateOnMatchAux: async () => {
    db.simulations++;
    await db.gate;
    if (db.supersede) db.room["state"] = { settlementClaim: "new-owner" };
    if (db.failReplay) throw new Error("network failure");
    return { hg: 2, ag: 1, minute: 94, steps: 100 };
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      let patch: Record<string, unknown> | undefined;
      let deleting = false;
      const value = (row: Record<string, unknown>, key: string) =>
        key === "state->>settlementClaim"
          ? (row["state"] as Record<string, unknown>)?.["settlementClaim"]
          : row[key];
      const execute = () => {
        if (table === "match_room_secrets") {
          if (deleting) db.seedDeletes++;
          else db.seedReads++;
          return { data: { seed: "private-seed-server-only" }, error: null };
        }
        if (!filters.every((test) => test(db.room))) return { data: null, error: null };
        if (patch) Object.assign(db.room, patch);
        return { data: structuredClone(db.room), error: null };
      };
      const query = {
        select: () => query,
        eq: (key: string, expected: unknown) => {
          filters.push((row) => value(row, key) === expected);
          return query;
        },
        not: (key: string, _op: string, expected: unknown) => {
          filters.push((row) => value(row, key) !== expected);
          return query;
        },
        update: (next: Record<string, unknown>) => {
          patch = next;
          return query;
        },
        delete: () => {
          deleting = true;
          return query;
        },
        maybeSingle: async () => execute(),
        then: (resolve: (result: unknown) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return query;
    },
  },
}));
import {
  finishMatchRoom,
  leaveMatchRoom,
  createMatchRoom,
  joinMatchRoom,
} from "./multiplayer.functions";
// Warm the mocked boundary before racing imports in concurrent handlers.
await import("@/integrations/supabase/client.server");
await import("./match-aux-client.server");
const roomId = "00000000-0000-4000-8000-000000000001";
const finish = finishMatchRoom as unknown as (args: {
  data: Record<string, unknown>;
  context: { userId: string };
}) => Promise<unknown>;
const leave = leaveMatchRoom as unknown as typeof finish;
const request = (userId = "guest", extra = {}) =>
  finish({ data: { roomId, ...extra }, context: { userId } });
beforeEach(() => {
  db.room = {
    id: roomId,
    host_id: "host",
    guest_id: "guest",
    host_club: "fla",
    guest_club: "pal",
    server_seeded: true,
    status: "live",
    state: {},
    updated_at: new Date().toISOString(),
  };
  db.seedReads = db.seedDeletes = db.simulations = 0;
  db.failReplay = db.supersede = false;
  db.gate = undefined;
});

describe("authoritative multiplayer settlement", () => {
  it.each(["host", "guest"])(
    "lets %s confirm the trusted result without accepting forged scores",
    async (user) => {
      expect(await request(user, { hg: 999, ag: 0, seed: "forged" })).toEqual({ ok: true });
      expect(db.room["state"]).toEqual({ hg: 2, ag: 1 });
      expect(db.room["status"]).toBe("done");
      expect(db.seedDeletes).toBe(1);
    },
  );
  it("rejects outsiders before reading the seed or running a replay", async () => {
    expect(await request("stranger")).toEqual({ ok: false, reason: "not_participant" });
    expect(db.seedReads + db.simulations + db.seedDeletes).toBe(0);
    expect(db.room["status"]).toBe("live");
  });
  it("deduplicates concurrent participant requests", async () => {
    let release!: () => void;
    db.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = request("host");
    await vi.waitFor(() => expect(db.simulations).toBe(1));
    expect(await request("guest")).toEqual({ ok: false, reason: "settling" });
    release();
    expect(await first).toEqual({ ok: true });
    expect(db.simulations).toBe(1);
    expect(db.room["state"]).toEqual({ hg: 2, ag: 1 });
  });
  it("keeps an active lease and its private seed intact", async () => {
    db.room["status"] = "settling";
    expect(await request()).toEqual({ ok: false, reason: "settling" });
    expect(db.seedReads + db.simulations + db.seedDeletes).toBe(0);
  });
  it("recovers an expired claim after a server crash", async () => {
    db.room["status"] = "settling";
    db.room["updated_at"] = new Date(Date.now() - 301_000).toISOString();
    db.room["state"] = { settlementClaim: "crashed" };
    expect(await request()).toEqual({ ok: true });
    expect(db.room["state"]).toEqual({ hg: 2, ag: 1 });
  });
  it("fails closed for invalid lease timestamps", async () => {
    db.room["status"] = "settling";
    db.room["updated_at"] = "invalid";
    expect(await request()).toEqual({ ok: false, reason: "settling" });
    expect(db.simulations).toBe(0);
  });
  it("cannot publish or clean a newer owner's claim", async () => {
    db.supersede = true;
    expect(await request()).toEqual({ ok: false, reason: "room_closed" });
    expect(db.room["state"]).toEqual({ settlementClaim: "new-owner" });
    expect(db.room["status"]).toBe("settling");
    expect(db.seedDeletes).toBe(0);
  });
  it("releases its own failed replay for a retry", async () => {
    db.failReplay = true;
    expect(await request()).toEqual({ ok: false, reason: "simulation_failed" });
    expect(db.room["status"]).toBe("live");
    expect(db.room["state"]).toEqual({});
    expect(db.seedDeletes).toBe(0);
    db.failReplay = false;
    expect(await request()).toEqual({ ok: true });
  });
  it("settles a live departure instead of letting a participant erase a loss", async () => {
    expect(await leave({ data: { roomId }, context: { userId: "guest" } })).toEqual({ ok: true });
    expect(db.room["status"]).toBe("done");
    expect(db.room["state"]).toEqual({ hg: 2, ag: 1 });
    expect(db.simulations).toBe(1);
  });
  it.each(["toString", "constructor", "__proto__"])(
    "rejects inherited club key %s",
    async (club) => {
      const create = createMatchRoom as unknown as typeof finish;
      const join = joinMatchRoom as unknown as typeof finish;
      expect(await create({ data: { hostClub: club }, context: { userId: "host" } })).toEqual({
        ok: false,
        reason: "invalid_club",
      });
      expect(
        await join({ data: { roomId, guestClub: club }, context: { userId: "guest" } }),
      ).toEqual({ ok: false, reason: "invalid_club" });
      db.room["host_club"] = club;
      expect(await request()).toEqual({ ok: false, reason: "invalid_room" });
      expect(db.simulations + db.seedReads).toBe(0);
    },
  );
  it("does not repeat completed simulations", async () => {
    await request();
    expect(await request()).toEqual({ ok: true });
    expect(db.simulations).toBe(1);
  });
});
