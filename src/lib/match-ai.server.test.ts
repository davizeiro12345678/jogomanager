import { afterEach, describe, expect, it, vi } from "vitest";
import { requestMatchTactics } from "./match-ai.server";

const valid = { mentality: 3, pressing: 2, width: 1, tempo: 2 };
const summary = { homeStrength: 83, awayStrength: 82, difficulty: "dificil" as const };
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("server tactical model", () => {
  it("requests the chosen model with maximum reasoning and validates the response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: JSON.stringify(valid) }] },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(requestMatchTactics("test-secret", summary)).resolves.toEqual(valid);
    const [url, request] = fetcher.mock.calls[0]!;
    const payload = JSON.parse(request.body as string);
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(payload.model).toBe("gpt-6.1-terra");
    expect(payload.reasoning.effort).toBe("max");
    expect(payload.store).toBe(false);
    expect(payload.text.format.strict).toBe(true);
  });

  it.each([
    { status: "incomplete", output: [] },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
    },
    {
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ ...valid, tempo: 99 }) }],
        },
      ],
    },
    {
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ ...valid, score: 99 }) }],
        },
      ],
    },
  ])("returns no plan for incomplete, refused or invalid responses", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body)));
    await expect(requestMatchTactics("test-secret", summary)).resolves.toBeNull();
  });

  it("falls back on provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("not logged")));
    await expect(requestMatchTactics("test-secret", summary)).resolves.toBeNull();
  });
});
