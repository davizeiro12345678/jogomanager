import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "00000000-0000-4000-8000-000000000001";
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown): unknown => value;
    const builder = {
      middleware: () => builder,
      validator(next: (value: unknown) => unknown) {
        validate = next;
        return builder;
      },
      handler(handle: (args: { data: unknown; context: { userId: string } }) => unknown) {
        return async (args: { data?: unknown } = {}) =>
          handle({ data: validate(args.data), context: { userId: USER } });
      },
    };
    return builder;
  },
}));

const state = (round: number) => ({
  leagueId: "fixture-league",
  clubId: "fixture-club",
  managerName: "Fixture manager",
  season: 1,
  round,
  results: [],
  fixtures: [],
});
type Stored = {
  user_id: string;
  state: ReturnType<typeof state>;
  updated_at: string;
  verified_progress: boolean;
};
let row: Stored | null;
let revision: number;
let writes: number;
let readsFail: boolean;
let beforeWrite: (() => void) | undefined;
let functions: typeof import("./career.functions");
const timestamp = () => `2026-10-19T12:00:00.${String(++revision).padStart(6, "0")}+00:00`;

function committed(round: number): Stored {
  return { user_id: USER, state: state(round), updated_at: timestamp(), verified_progress: false };
}

beforeEach(async () => {
  vi.resetModules();
  revision = 0;
  row = committed(1);
  writes = 0;
  readsFail = false;
  beforeWrite = undefined;
  vi.stubEnv("SUPABASE_URL", "https://career-fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_career-fixture");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    if (method === "GET") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
      return readsFail
        ? Response.json({ code: "XX000", message: "database unavailable" }, { status: 500 })
        : Response.json(row ? [row] : []);
    }
    writes++;
    beforeWrite?.();
    const incoming = JSON.parse(String(init?.body)) as {
      user_id?: string;
      state: ReturnType<typeof state>;
      verified_progress: boolean;
    };
    if (method === "PATCH") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
      if (!row || url.searchParams.get("updated_at") !== `eq.${row.updated_at}`)
        return Response.json([]);
    } else if (method === "POST") {
      expect(incoming.user_id).toBe(USER);
      const upsert = new Headers(init?.headers)
        .get("prefer")
        ?.includes("resolution=merge-duplicates");
      if (row && !upsert)
        return Response.json({ code: "23505", message: "duplicate user" }, { status: 409 });
    } else {
      throw new Error(`Unexpected career write: ${method}`);
    }
    row = {
      user_id: USER,
      state: incoming.state,
      updated_at: timestamp(),
      verified_progress: incoming.verified_progress,
    };
    return Response.json([{ user_id: USER }]);
  });
  functions = await import("./career.functions");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("manager career concurrent writes", () => {
  it("refuses a save intended for another account after the active token changes", async () => {
    await expect(
      functions.saveCareer({
        data: {
          state: state(2),
          expectedOwnerId: "00000000-0000-4000-8000-000000000002",
        },
      }),
    ).rejects.toThrow();
    expect(writes).toBe(0);
    expect(row).toMatchObject({ state: { round: 1 } });
  });

  it("refuses a deletion intended for a previous account", async () => {
    await expect(
      functions.deleteCareer({
        data: {
          expectedOwnerId: "00000000-0000-4000-8000-000000000002",
        },
      }),
    ).rejects.toThrow();
    expect(writes).toBe(0);
    expect(row).toMatchObject({ state: { round: 1 } });
  });

  it("fails closed when the previous cloud save cannot be read", async () => {
    readsFail = true;
    await expect(
      functions.saveCareer({ data: { state: state(2), expectedOwnerId: USER } }),
    ).rejects.toThrow();
    expect(writes).toBe(0);
    expect(row).toMatchObject({ state: { round: 1 } });
  });

  it("preserves newer progress committed after the initial read", async () => {
    beforeWrite = () => {
      row = committed(3);
      beforeWrite = undefined;
    };
    const result = await functions.saveCareer({ data: { state: state(2), expectedOwnerId: USER } });
    expect(result.stale).toBe(true);
    expect(row).toMatchObject({ state: { round: 3 } });
    expect(writes).toBe(1);
  });

  it("does not overwrite a competing first save after an empty read", async () => {
    row = null;
    beforeWrite = () => {
      row = committed(3);
      beforeWrite = undefined;
    };
    const result = await functions.saveCareer({ data: { state: state(2), expectedOwnerId: USER } });
    expect(result.stale).toBe(true);
    expect(row).toMatchObject({ state: { round: 3 } });
  });

  it("retries a benign concurrent change using the newly read revision", async () => {
    beforeWrite = () => {
      row = committed(1);
      beforeWrite = undefined;
    };
    const result = await functions.saveCareer({ data: { state: state(2), expectedOwnerId: USER } });
    expect(result).toMatchObject({ ok: true, stale: false, verifiedProgress: false });
    expect(row).toMatchObject({ state: { round: 2 } });
    expect(writes).toBe(2);
  });

  it("bounds retries instead of forcing an overwrite under continued contention", async () => {
    beforeWrite = () => {
      row = committed(1);
    };
    await expect(
      functions.saveCareer({ data: { state: state(2), expectedOwnerId: USER } }),
    ).rejects.toThrow();
    expect(writes).toBe(3);
    expect(row).toMatchObject({ state: { round: 1 } });
  });
});
