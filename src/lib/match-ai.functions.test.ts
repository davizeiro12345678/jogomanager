import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), budget: vi.fn(), model: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    middleware: () => ({
      validator: (parse: (x: unknown) => unknown) => ({
        handler: (handle: (x: unknown) => unknown) => (args: { data: unknown; context: unknown }) =>
          handle({ ...args, data: parse(args.data) }),
      }),
    }),
  }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock("@/game/data/leagues", () => ({ CLUBS: { fla: { strength: 85 }, pal: { strength: 84 } } }));
vi.mock("@/game/quickMatch", () => ({
  buildTeamSetup: () => ({
    players: [{ pos: "FW", pace: 80, shooting: 80, passing: 80, defending: 80, physical: 80 }],
  }),
}));
vi.mock("@/lib/ai-budget.server", () => ({ reserveAiBudget: mocks.budget }));
vi.mock("@/lib/match-ai.server", () => ({ requestMatchTactics: mocks.model }));

import { requestAiTacticalPlan } from "./match-ai.functions";
const request = requestAiTacticalPlan as unknown as (args: {
  data: Record<string, unknown>;
  context: { userId: string };
}) => Promise<unknown>;
const fixture = {
  data: { homeClub: "fla", awayClub: "pal", difficulty: "dificil" },
  context: { userId: "user-1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MATCH_AI_OPENAI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "test-secret");
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.budget.mockResolvedValue(true);
  mocks.model.mockResolvedValue({
    mentality: 3,
    pressing: 2,
    width: 1,
    tempo: 2,
    players: { GK: "cautious", DF: "balanced", MF: "attacking", FW: "attacking" },
    homePlayers: { GK: "cautious", DF: "balanced", MF: "balanced", FW: "attacking" },
    crowd: { climate: "cobranca", intensity: 2 },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("tactical AI server admission", () => {
  it("reserves a user rate limit and budget before requesting a plan", async () => {
    await expect(request(fixture)).resolves.toEqual({
      mentality: 3,
      pressing: 2,
      width: 1,
      tempo: 2,
      players: { GK: "cautious", DF: "balanced", MF: "attacking", FW: "attacking" },
      homePlayers: { GK: "cautious", DF: "balanced", MF: "balanced", FW: "attacking" },
      crowd: { climate: "cobranca", intensity: 2 },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_guest_checkout_attempt", {
      _email_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(mocks.budget).toHaveBeenCalledWith("text", 200);
    expect(mocks.model).toHaveBeenCalledWith(
      "test-secret",
      expect.objectContaining({
        homeStrength: 85,
        awayStrength: 84,
        awayRoles: [{ position: "FW", attributes: [80, 80, 80, 80, 80] }],
      }),
    );
  });
  it("never calls the model when quota, budget or configuration rejects the request", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await request(fixture)).toBeNull();
    mocks.budget.mockResolvedValueOnce(false);
    expect(await request(fixture)).toBeNull();
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await request(fixture)).toBeNull();
    expect(mocks.model).not.toHaveBeenCalled();
  });
  it("rejects unknown clubs and browser-supplied extra data", async () => {
    expect(
      await request({ ...fixture, data: { ...fixture.data, homeClub: "constructor" } }),
    ).toBeNull();
    expect(() => request({ ...fixture, data: { ...fixture.data, score: 99 } })).toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
