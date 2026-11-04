import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerState } from "@/game/types";

const USER = "00000000-0000-4000-8000-000000000001";
const state = (extra: Record<string, unknown> = {}) =>
  ({
    season: 1,
    round: 1,
    clubId: "fixture",
    results: [],
    trophies: [],
    matchLog: [],
    finances: { budget: 50 },
    ...extra,
  }) as unknown as CareerState;

let score: number | null;
let scoreFails: boolean;
let saved: { verified_progress: boolean } | undefined;
let signals: Array<{ reason: string; points: number }>;
let saveValidatedCareer: typeof import("./career-save.server").saveValidatedCareer;

beforeEach(async () => {
  vi.resetModules();
  score = 0;
  scoreFails = false;
  saved = undefined;
  signals = [];
  vi.stubEnv("SUPABASE_URL", "https://career-fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_career-fixture");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    if (url.pathname.endsWith("/rpc/career_risk_score")) {
      return scoreFails
        ? Response.json({ code: "PGRST202", message: "function unavailable" }, { status: 404 })
        : Response.json(score);
    }
    if (url.pathname.endsWith("/career_risk_signals")) {
      signals = JSON.parse(String(init?.body));
      return new Response(null, { status: 201 });
    }
    if (url.pathname.endsWith("/careers") && method === "GET") return Response.json([]);
    if (url.pathname.endsWith("/careers") && method === "POST") {
      saved = JSON.parse(String(init?.body));
      return Response.json([{ user_id: USER }]);
    }
    throw new Error(`Unexpected test request: ${method} ${url.pathname}`);
  });
  ({ saveValidatedCareer } = await import("./career-save.server"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("career save trust boundary", () => {
  it("attests a verified, plausible save only after a valid low risk score", async () => {
    expect(await saveValidatedCareer(USER, state(), true)).toMatchObject({
      verifiedProgress: true,
    });
    expect(saved?.verified_progress).toBe(true);
  });

  it.each(["unavailable", "missing", "high"])(
    "keeps the personal save unverified when the risk score is %s",
    async (condition) => {
      scoreFails = condition === "unavailable";
      score = condition === "missing" ? null : condition === "high" ? 60 : 0;
      expect(await saveValidatedCareer(USER, state(), true)).toMatchObject({
        ok: true,
        verifiedProgress: false,
      });
      expect(saved?.verified_progress).toBe(false);
    },
  );

  it("does not attest a save when plausibility evaluation cannot finish", async () => {
    expect(await saveValidatedCareer(USER, state({ trophies: null }), true)).toMatchObject({
      ok: true,
      verifiedProgress: false,
    });
    expect(saved?.verified_progress).toBe(false);
  });

  it("keeps an inflated budget personal and records a risk signal", async () => {
    expect(
      await saveValidatedCareer(USER, state({ finances: { budget: 9000 } }), true),
    ).toMatchObject({
      ok: true,
      verifiedProgress: false,
    });
    expect(signals).toEqual([expect.objectContaining({ reason: "budget", points: 40 })]);
    expect(saved?.verified_progress).toBe(false);
  });
});
