import { beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({
  from: vi.fn(),
  verify: vi.fn(),
  read: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown) => input;
    const builder = {
      middleware: () => builder,
      validator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: unknown) => Promise<unknown>) => (args: { data?: unknown; context: unknown }) =>
          fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: deps.from } }));
vi.mock("./career-verification", () => ({ verifyCareerProgress: deps.verify }));
import { loadCareer, saveCareer, deleteCareer } from "./career.functions";
type Handler = (args: { data?: unknown; context: unknown }) => Promise<unknown>;
const load = loadCareer as unknown as Handler,
  save = saveCareer as unknown as Handler,
  remove = deleteCareer as unknown as Handler;
const state = {
  leagueId: "bra1",
  clubId: "fla",
  managerName: "Fixture",
  season: 1,
  round: 1,
  fixtures: [],
  results: [],
};
const context = { userId: "00000000-0000-4000-8000-000000000002", supabase: { from: deps.from } };
beforeEach(() => {
  vi.resetAllMocks();
  const chain = {
    select: () => chain,
    eq: deps.eq,
    maybeSingle: deps.read,
    upsert: deps.upsert,
    update: deps.update,
    insert: deps.insert,
    delete: deps.remove,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ user_id: context.userId }], error: null }).then(resolve),
  };
  deps.eq.mockReturnValue(chain);
  deps.from.mockReturnValue(chain);
  deps.remove.mockReturnValue(chain);
  deps.update.mockReturnValue(chain);
  deps.insert.mockReturnValue(chain);
  deps.read.mockResolvedValue({
    data: { state, updated_at: "2026-10-19", verified_progress: false },
    error: null,
  });
  deps.upsert.mockResolvedValue({ error: null });
  deps.verify.mockReturnValue(false);
});
describe("career request owner binding", () => {
  it.each([
    ["load", load, { expectedOwnerId: "00000000-0000-4000-8000-000000000001" }],
    ["save", save, { state, expectedOwnerId: "00000000-0000-4000-8000-000000000001" }],
    ["delete", remove, { expectedOwnerId: "00000000-0000-4000-8000-000000000001" }],
  ])(
    "rejects account changes before %s performs database or progress work",
    async (_name, handler, data) => {
      await expect((handler as Handler)({ data, context })).rejects.toThrow(/conta mudou/);
      expect(deps.from).not.toHaveBeenCalled();
      expect(deps.verify).not.toHaveBeenCalled();
    },
  );
  it("loads only the authenticated expected account", async () => {
    await expect(
      load({ data: { expectedOwnerId: "00000000-0000-4000-8000-000000000002" }, context }),
    ).resolves.toHaveProperty("state", state);
    expect(deps.eq).toHaveBeenCalledWith("user_id", "00000000-0000-4000-8000-000000000002");
  });
  it("saves a matched request under its authenticated account", async () => {
    await expect(
      save({ data: { state, expectedOwnerId: "00000000-0000-4000-8000-000000000002" }, context }),
    ).resolves.toEqual({
      ok: true,
      stale: false,
      verifiedProgress: false,
    });
    expect(deps.update).toHaveBeenCalledWith(expect.objectContaining({ state }));
    expect(deps.eq).toHaveBeenCalledWith("user_id", context.userId);
    expect(deps.eq).toHaveBeenCalledWith("updated_at", "2026-10-19");
    expect(deps.upsert).not.toHaveBeenCalled();
  });
  it("deletes only the matched authenticated owner", async () => {
    await expect(
      remove({ data: { expectedOwnerId: "00000000-0000-4000-8000-000000000002" }, context }),
    ).resolves.toEqual({
      ok: true,
    });
    expect(deps.remove).toHaveBeenCalledOnce();
    expect(deps.eq).toHaveBeenCalledWith("user_id", "00000000-0000-4000-8000-000000000002");
  });
  it("keeps older load clients compatible while still filtering by authenticated owner", async () => {
    await expect(load({ context })).resolves.toHaveProperty("state");
    expect(deps.eq).toHaveBeenCalledWith("user_id", "00000000-0000-4000-8000-000000000002");
  });
});

it("preserves the main cloud stale-save guard while rejecting account mismatches", async () => {
  deps.read.mockResolvedValue({
    data: { state: { ...state, round: 8 }, verified_progress: false },
    error: null,
  });
  await expect(
    save({ data: { state, expectedOwnerId: "00000000-0000-4000-8000-000000000002" }, context }),
  ).resolves.toMatchObject({ ok: false, stale: true });
  expect(deps.upsert).not.toHaveBeenCalled();
});

it("does not overwrite cloud progress when reading the prior state fails", async () => {
  deps.read.mockResolvedValue({ data: null, error: { message: "private db detail" } });
  await expect(
    save({ data: { state, expectedOwnerId: "00000000-0000-4000-8000-000000000002" }, context }),
  ).rejects.toThrow("Não foi possível conferir");
  expect(deps.upsert).not.toHaveBeenCalled();
});
