import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ simulate: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (validate: (input: unknown) => unknown) => ({
        handler:
          (handle: (args: { data: unknown; context: unknown }) => unknown) =>
          async (args: { data: unknown; context: unknown }) =>
            handle({ ...args, data: validate(args.data) }),
      }),
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: deps.from } }));
vi.mock("@/game/data/leagues", () => ({ CLUBS: { fla: {}, pal: {} } }));
vi.mock("@/game/quickMatch", () => ({ buildTeamSetup: vi.fn() }));
vi.mock("@/game/sim", () => ({
  LIVE_MATCH_CLOCK_SCALE: 6,
  MATCH_SIMULATION_STEP: 1 / 30,
  MATCH_SIMULATION_TICK_LIMIT: 60000,
  MatchSim: class {},
}));
vi.mock("./match-aux-client.server", () => ({
  matchAuxEnabled: () => true,
  simulateOnMatchAux: deps.simulate,
}));

import {
  createMatchRoom,
  finishMatchRoom,
  joinMatchRoom,
  leaveMatchRoom,
} from "./multiplayer.functions";

const roomId = "123e4567-e89b-42d3-a456-426614174000";
type Row = Record<string, unknown>;
let room: Row;
let secret: Row | null;
let beforeUpdate: (() => void) | null;

/** Minimal in-memory conditional update model: unlike a static mock, the
 * predicates are checked at the instant each write is executed. */
class Query {
  private filters: ((row: Row) => boolean)[] = [];
  private updateValue: Row | null = null;
  private deleting = false;
  constructor(private table: string) {}
  select() {
    return this;
  }
  update(value: Row) {
    this.updateValue = value;
    return this;
  }
  delete() {
    this.deleting = true;
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }
  not(key: string, op: string, value: unknown) {
    if (op !== "is" || value !== null) throw new Error("unexpected filter");
    this.filters.push((row) => row[key] !== null && row[key] !== undefined);
    return this;
  }
  contains(key: string, expected: Row) {
    this.filters.push((row) => {
      const actual = row[key] as Row | null;
      return Boolean(actual && Object.entries(expected).every(([k, v]) => actual[k] === v));
    });
    return this;
  }
  private execute() {
    const row = this.table === "match_rooms" ? room : secret;
    if (this.updateValue && beforeUpdate) {
      const callback = beforeUpdate;
      beforeUpdate = null;
      callback();
    }
    if (!row || !this.filters.every((filter) => filter(row))) return { data: null, error: null };
    if (this.updateValue) Object.assign(row, structuredClone(this.updateValue));
    if (this.deleting && this.table === "match_room_secrets") secret = null;
    return { data: structuredClone(row), error: null };
  }
  maybeSingle() {
    return Promise.resolve(this.execute());
  }
  then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

const finish = finishMatchRoom as unknown as (args: {
  data: { roomId: string };
  context: { userId: string };
}) => Promise<{ ok: boolean; reason?: string }>;
const request = () => finish({ data: { roomId }, context: { userId: "host" } });
const leave = leaveMatchRoom as unknown as typeof finish;
const result = (hg: number) => ({ hg, ag: 0, minute: 93, steps: 1 });

beforeEach(() => {
  vi.clearAllMocks();
  room = {
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
  secret = { room_id: roomId, seed: "a-very-long-private-seed" };
  beforeUpdate = null;
  deps.from.mockImplementation((table: string) => new Query(table));
});

describe("multiplayer settlement claims", () => {
  it("rejects inherited object properties as club identifiers before database access", async () => {
    const create = createMatchRoom as unknown as (args: unknown) => Promise<unknown>;
    const join = joinMatchRoom as unknown as (args: unknown) => Promise<unknown>;
    expect(await create({ data: { hostClub: "__proto__" }, context: { userId: "host" } })).toEqual({
      ok: false,
      reason: "invalid_club",
    });
    expect(
      await join({ data: { roomId, guestClub: "constructor" }, context: { userId: "guest" } }),
    ).toEqual({
      ok: false,
      reason: "invalid_club",
    });
    expect(deps.from).not.toHaveBeenCalled();
  });

  it("keeps an active settlement exclusive", async () => {
    room["status"] = "settling";
    expect(await request()).toEqual({ ok: false, reason: "settling" });
    expect(deps.simulate).not.toHaveBeenCalled();
  });

  it("recovers a stale settlement and publishes a server result", async () => {
    room["status"] = "settling";
    room["updated_at"] = new Date(Date.now() - 180_000).toISOString();
    deps.simulate.mockResolvedValue(result(2));
    expect(await request()).toEqual({ ok: true });
    expect(room["status"]).toBe("done");
    expect(room["state"]).toEqual({ hg: 2, ag: 0 });
  });

  it("prevents an expired worker from releasing or publishing over its replacement", async () => {
    let resolveFirst!: (value: ReturnType<typeof result>) => void;
    let resolveSecond!: (value: ReturnType<typeof result>) => void;
    deps.simulate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const first = request();
    await vi.waitFor(() => expect(deps.simulate).toHaveBeenCalledTimes(1));
    room["updated_at"] = new Date(Date.now() - 180_000).toISOString();
    const second = request();
    await vi.waitFor(() => expect(deps.simulate).toHaveBeenCalledTimes(2));
    resolveFirst(result(9));
    expect(await first).toEqual({ ok: false, reason: "room_closed" });
    expect(room["status"]).toBe("settling");
    resolveSecond(result(2));
    expect(await second).toEqual({ ok: true });
    expect(room["state"]).toEqual({ hg: 2, ag: 0 });
  });

  it("does not erase the seed if leaving races with settlement", async () => {
    beforeUpdate = () => {
      room["status"] = "settling";
    };
    expect(await leave({ data: { roomId }, context: { userId: "host" } })).toEqual({
      ok: false,
      reason: "settling",
    });
    expect(room["status"]).toBe("settling");
    expect(secret).not.toBeNull();
  });
});
