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
  results: [] as { round: number; home: string; away: string; hg: number; ag: number }[],
  fixtures: [],
});
type Stored = {
  user_id: string;
  state: ReturnType<typeof state>;
  updated_at: string;
  verified_progress: boolean;
  generation: number;
  deleted_at: string | null;
};
let row: Stored | null;
let revision: number;
let writes: number;
let riskSignalInserts: Array<Array<{ user_id: string; reason: string; points: number }>>;
let physicalDeletes: number;
let readsFail: boolean;
let riskRpcResponse: { status?: number; body?: unknown };
let riskRpcMock: ReturnType<typeof vi.fn<() => Promise<Response>>>;
let beforeWrite: (() => void) | undefined;
let functions: typeof import("./career.functions");
const timestamp = () => `2026-10-19T12:00:00.${String(++revision).padStart(6, "0")}+00:00`;

function committed(round: number): Stored {
  return {
    user_id: USER,
    state: state(round),
    updated_at: timestamp(),
    verified_progress: false,
    generation: 1,
    deleted_at: null,
  };
}

beforeEach(async () => {
  vi.resetModules();
  revision = 0;
  row = committed(1);
  writes = 0;
  riskSignalInserts = [];
  physicalDeletes = 0;
  readsFail = false;
  riskRpcResponse = { body: 0 };
  riskRpcMock = vi.fn(async () =>
    Response.json(riskRpcResponse.body, { status: riskRpcResponse.status ?? 200 }),
  );
  beforeWrite = undefined;
  vi.stubEnv("SUPABASE_URL", "https://career-fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_career-fixture");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    if (method === "POST" && url.pathname.endsWith("/rpc/career_risk_score")) {
      return riskRpcMock();
    }
    if (method === "GET") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
      return readsFail
        ? Response.json({ code: "XX000", message: "database unavailable" }, { status: 500 })
        : Response.json(row ? [row] : []);
    }
    if (method === "POST" && url.pathname.endsWith("/career_risk_signals")) {
      riskSignalInserts.push(
        JSON.parse(String(init?.body)) as Array<{
          user_id: string;
          reason: string;
          points: number;
        }>,
      );
      return Response.json([]);
    }
    writes++;
    beforeWrite?.();
    if (method === "POST" && url.pathname.endsWith("/rpc/delete_manager_career")) {
      const input = JSON.parse(String(init?.body)) as { p_user_id: string };
      expect(input.p_user_id).toBe(USER);
      if (!row) {
        row = {
          ...committed(1),
          state: {} as ReturnType<typeof state>,
          generation: 1,
          deleted_at: timestamp(),
        };
      } else if (!row.deleted_at) {
        row = { ...row, generation: row.generation + 1, deleted_at: timestamp() };
      }
      return Response.json([
        {
          status: row.generation === 1 ? "applied" : "already_deleted",
          generation: row.generation,
          deleted_at: row.deleted_at,
        },
      ]);
    }
    if (method === "POST" && url.pathname.endsWith("/rpc/create_manager_career")) {
      const input = JSON.parse(String(init?.body)) as {
        p_user_id: string;
        p_state: ReturnType<typeof state>;
        p_expected_generation: number | null;
        p_verified_progress: boolean;
      };
      expect(input.p_user_id).toBe(USER);
      if (!row && input.p_expected_generation === null) {
        row = {
          ...committed(1),
          state: input.p_state,
          verified_progress: input.p_verified_progress,
        };
        return Response.json([
          { status: "applied", generation: row.generation, deleted_at: row.deleted_at },
        ]);
      }
      if (row?.deleted_at && input.p_expected_generation === row.generation) {
        row = {
          ...row,
          state: input.p_state,
          updated_at: timestamp(),
          verified_progress: input.p_verified_progress,
          generation: row.generation + 1,
          deleted_at: null,
        };
        return Response.json([
          { status: "applied", generation: row.generation, deleted_at: row.deleted_at },
        ]);
      }
      return Response.json([
        {
          status: row?.deleted_at ? "conflict_deleted" : "conflict_active",
          generation: row?.generation ?? input.p_expected_generation ?? 1,
          deleted_at: row?.deleted_at ?? null,
        },
      ]);
    }
    if (method === "DELETE") {
      physicalDeletes++;
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
      row = null;
      return Response.json([]);
    }
    const incoming = JSON.parse(String(init?.body)) as {
      user_id?: string;
      state: ReturnType<typeof state>;
      verified_progress: boolean;
    };
    if (method === "PATCH") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER}`);
      if (
        !row ||
        url.searchParams.get("updated_at") !== `eq.${row.updated_at}` ||
        url.searchParams.get("generation") !== `eq.${row.generation}` ||
        url.searchParams.get("deleted_at") !== "is.null"
      )
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
      generation: row?.generation ?? 1,
      deleted_at: null,
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

  it("does not resurrect a stale save after delete when local reset cleanup is partial", async () => {
    await expect(
      functions.deleteCareer({ data: { expectedOwnerId: USER } }),
    ).resolves.toMatchObject({ ok: true });
    // Simulates the old device retaining its snapshot/outbox after the cloud
    // delete succeeded but clearLocalCareer could not confirm cleanup.
    expect(row).toMatchObject({ generation: 2, deleted_at: expect.any(String) });
    expect(physicalDeletes).toBe(0);

    const result = await functions.saveCareer({
      data: { state: state(2), expectedOwnerId: USER },
    });

    expect(result).toMatchObject({ ok: false, deleted: true });
    expect(row).toMatchObject({ generation: 2, deleted_at: expect.any(String) });
  });

  it("fails closed when the previous cloud save cannot be read", async () => {
    readsFail = true;
    await expect(
      functions.saveCareer({
        data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
      }),
    ).rejects.toThrow();
    expect(writes).toBe(0);
    expect(row).toMatchObject({ state: { round: 1 } });
  });

  it.each([
    ["RPC error", { status: 500, body: { message: "unavailable" } }],
    ["missing score", { body: undefined }],
    ["null score", { body: null }],
    ["invalid score shape", { body: { score: 0 } }],
  ])("does not attest a save when risk score is unavailable (%s)", async (_label, response) => {
    riskRpcResponse = response;
    const { saveValidatedCareer } = await import("./career-save.server");
    const result = await saveValidatedCareer(USER, state(2) as never, true, 1);
    expect(result).toMatchObject({ ok: true, stale: false, verifiedProgress: false });
    expect(row).toMatchObject({ state: { round: 2 }, verified_progress: false });
  });

  it("stores a personal save without attestation when the risk RPC transport rejects", async () => {
    riskRpcMock.mockRejectedValue(new Error("transport"));
    const { saveValidatedCareer } = await import("./career-save.server");
    await expect(saveValidatedCareer(USER, state(2) as never, true, 1)).resolves.toMatchObject({
      ok: true,
      stale: false,
      verifiedProgress: false,
    });
    expect(row).toMatchObject({ state: { round: 2 }, verified_progress: false });
  });

  it("does not attest a save when the confirmed risk score reaches the hold threshold", async () => {
    riskRpcResponse = { body: 60 };
    const { saveValidatedCareer } = await import("./career-save.server");
    const result = await saveValidatedCareer(USER, state(2) as never, true, 1);
    expect(result).toMatchObject({ ok: true, stale: false, verifiedProgress: false });
    expect(row).toMatchObject({ state: { round: 2 }, verified_progress: false });
  });

  it("preserves newer progress committed after the initial read", async () => {
    beforeWrite = () => {
      row = committed(3);
      beforeWrite = undefined;
    };
    const result = await functions.saveCareer({
      data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(result.stale).toBe(true);
    expect(row).toMatchObject({ state: { round: 3 } });
    expect(writes).toBe(1);
  });

  it("does not turn an ordinary save into an initial career create", async () => {
    row = null;
    const result = await functions.saveCareer({
      data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(result).toMatchObject({ ok: false, conflict: true, reason: "missing_head" });
    expect(row).toBeNull();
    expect(writes).toBe(0);
  });

  it("retries a benign concurrent change using the newly read revision", async () => {
    beforeWrite = () => {
      row = committed(1);
      beforeWrite = undefined;
    };
    const result = await functions.saveCareer({
      data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(result).toMatchObject({ ok: true, stale: false, verifiedProgress: false });
    expect(row).toMatchObject({ state: { round: 2 } });
    expect(writes).toBe(2);
  });

  it("conflicts after a CAS miss when an equal-score concurrent state differs", async () => {
    beforeWrite = () => {
      row = { ...committed(2), state: { ...state(2), managerName: "Other manager" } };
      beforeWrite = undefined;
    };
    const result = await functions.saveCareer({
      data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(result).toMatchObject({
      ok: false,
      conflict: true,
      reason: "same_score_divergence",
      generation: 1,
    });
    expect(row?.state.managerName).toBe("Other manager");
    expect(writes).toBe(1);
  });

  it("writes risk signals only for the CAS winner and not on an idempotent duplicate", async () => {
    const riskyState = {
      ...state(2),
      results: [{ round: 1, home: "fixture-club", away: "other-club", hg: 16, ag: 0 }],
      trophies: [],
    } as ReturnType<typeof state>;
    beforeWrite = () => {
      row = committed(1);
      beforeWrite = undefined;
    };
    const first = await functions.saveCareer({
      data: { state: riskyState, expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(first).toMatchObject({ ok: true, stale: false });
    expect(writes).toBe(2);
    expect(riskSignalInserts).toEqual([[{ user_id: USER, reason: "goals", points: 30 }]]);

    const duplicate = await functions.saveCareer({
      data: { state: riskyState, expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(duplicate).toMatchObject({ ok: true, stale: false });
    expect(writes).toBe(2);
    expect(riskSignalInserts).toHaveLength(1);
  });

  it("bounds retries instead of forcing an overwrite under continued contention", async () => {
    beforeWrite = () => {
      row = committed(1);
    };
    await expect(
      functions.saveCareer({
        data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
      }),
    ).rejects.toThrow();
    expect(writes).toBe(3);
    expect(row).toMatchObject({ state: { round: 1 } });
  });

  it("creates an initial career only through the explicit create endpoint", async () => {
    row = null;

    const result = await functions.createCareer({
      data: { state: state(1), expectedOwnerId: USER, expectedGeneration: null },
    });

    expect(result).toEqual({ ok: true, generation: 1 });
    expect(row).toMatchObject({ state: { round: 1 }, generation: 1, deleted_at: null });
  });

  it("recreates a tombstoned career only at its observed generation and rejects old saves", async () => {
    const deleted = await functions.deleteCareer({ data: { expectedOwnerId: USER } });
    expect(deleted).toMatchObject({ ok: true, generation: 2 });

    const created = await functions.createCareer({
      data: { state: state(1), expectedOwnerId: USER, expectedGeneration: 2 },
    });
    expect(created).toEqual({ ok: true, generation: 3 });

    const stale = await functions.saveCareer({
      data: { state: state(2), expectedOwnerId: USER, expectedGeneration: 1 },
    });
    expect(stale).toMatchObject({
      ok: false,
      conflict: true,
      reason: "generation_mismatch",
      generation: 3,
    });
    expect(row).toMatchObject({ generation: 3, state: { round: 1 }, deleted_at: null });
  });
});
