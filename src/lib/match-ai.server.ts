import { z } from "zod";
import type { Difficulty } from "@/game/quickMatch";

const TacticalPlan = z
  .object({
    mentality: z.number().int().min(0).max(4),
    pressing: z.number().int().min(0).max(2),
    width: z.number().int().min(0).max(2),
    tempo: z.number().int().min(0).max(2),
  })
  .strict();

export type MatchAiTacticalPlan = z.infer<typeof TacticalPlan>;
export interface MatchAiSummary {
  homeStrength: number;
  awayStrength: number;
  difficulty: Difficulty;
  homeAttributes?: number[];
  awayAttributes?: number[];
}

/** Data is produced from the server's catalog, never from player-authored text. */
export async function requestMatchTactics(
  apiKey: string,
  summary: MatchAiSummary,
): Promise<MatchAiTacticalPlan | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-6.1-terra",
        reasoning: { effort: "max" },
        store: false,
        max_output_tokens: 25_000,
        input: [
          {
            role: "developer",
            content:
              "Choose the away team's football tactics against the home team for a simulator. Inputs are catalog-derived ratings 0-100 and difficulty. Attribute arrays are averages in order pace, shooting, passing, defending, physical. The controls are mentality 0-4 and pressing, width and tempo 0-2. Return only the requested structured plan.",
          },
          { role: "user", content: JSON.stringify(summary) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "match_tactics",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                mentality: { type: "integer", enum: [0, 1, 2, 3, 4] },
                pressing: { type: "integer", enum: [0, 1, 2] },
                width: { type: "integer", enum: [0, 1, 2] },
                tempo: { type: "integer", enum: [0, 1, 2] },
              },
              required: ["mentality", "pressing", "width", "tempo"],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let content = "";
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 65_536) {
          await reader.cancel();
          return null;
        }
        content += decoder.decode(chunk.value, { stream: true });
      }
      content += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const envelope: unknown = JSON.parse(content);
    const checked = z
      .object({ status: z.literal("completed"), output: z.array(z.unknown()) })
      .safeParse(envelope);
    if (!checked.success) return null;
    const texts: string[] = [];
    for (const item of checked.data.output) {
      const message = z
        .object({ type: z.literal("message"), content: z.array(z.unknown()) })
        .safeParse(item);
      if (!message.success) continue;
      for (const part of message.data.content) {
        const output = z
          .object({ type: z.literal("output_text"), text: z.string().max(1024) })
          .safeParse(part);
        if (output.success) texts.push(output.data.text);
      }
    }
    if (texts.length !== 1) return null;
    const plan = TacticalPlan.safeParse(JSON.parse(texts[0]!));
    return plan.success ? plan.data : null;
  } catch {
    return null;
  }
}
