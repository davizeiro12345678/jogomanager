import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FELIPE_VOICE_ID } from "@/game/narration-voice";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (value: unknown) => value;
    const builder = {
      middleware: () => builder,
      validator: (next: typeof validate) => {
        validate = next;
        return builder;
      },
      handler: (handle: (args: { data: unknown }) => unknown) => (args: { data: unknown }) =>
        handle({ data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/ai-budget.server", () => ({ reserveAiBudget: async () => true }));
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "test-only-voice-key");
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("bounded match voice generation", () => {
  it("uses narrator delivery for a goal, strips user audio tags and bounds the provider request", async () => {
    request.mockResolvedValue(new Response(new Uint8Array([1, 2])));
    const { narrateEvent } = await import("./tts.functions");
    expect(
      await narrateEvent({
        data: { lang: "pt", event: "goal", team: "[whispers] Clube", variant: 0 },
      }),
    ).toEqual({ ok: true, audio: "AQI=" });
    const [url, options] = request.mock.calls[0]!;
    const body = JSON.parse(String(options?.body));
    expect(String(url)).toContain("/text-to-dialogue/stream");
    expect(body.inputs[0].voice_id).toBe(FELIPE_VOICE_ID);
    expect(body.inputs[0].text).toMatch(/^\[excited\] /);
    expect(body.inputs[0].text).not.toContain("[whispers]");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(body.settings).sort()).toEqual(["similarity_boost", "stability"]);
  });

  it("keeps model tags out of legacy fallback speech", async () => {
    request
      .mockResolvedValueOnce(new Response("unavailable", { status: 404 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 404 }))
      .mockResolvedValue(new Response(new Uint8Array([1, 2])));
    const { narrateEvent } = await import("./tts.functions");
    expect(
      await narrateEvent({ data: { lang: "pt", event: "goal", team: "Clube" } }),
    ).toMatchObject({ ok: true });
    const body = JSON.parse(String(request.mock.calls.at(-1)?.[1]?.body));
    expect(body.model_id).toBe("eleven_flash_v2_5");
    expect(body.text).not.toContain("[excited]");
  });

  it("returns the local fallback on provider failure without logging provider bodies", async () => {
    request.mockResolvedValue(new Response("private provider diagnostics", { status: 503 }));
    const { narrateEvent } = await import("./tts.functions");
    expect(await narrateEvent({ data: { lang: "pt", event: "shot", team: "Clube" } })).toEqual({
      ok: false,
      reason: "error",
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("private provider"));
  });
});
