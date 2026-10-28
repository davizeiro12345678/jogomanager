import { z } from "zod";
import type { Difficulty } from "@/game/quickMatch";

const PlayerApproach = z.enum(["cautious", "balanced", "attacking"]);
const TacticalPlan = z
  .object({
    mentality: z.number().int().min(0).max(4),
    pressing: z.number().int().min(0).max(2),
    width: z.number().int().min(0).max(2),
    tempo: z.number().int().min(0).max(2),
    players: z
      .object({ GK: PlayerApproach, DF: PlayerApproach, MF: PlayerApproach, FW: PlayerApproach })
      .strict(),
    homePlayers: z
      .object({ GK: PlayerApproach, DF: PlayerApproach, MF: PlayerApproach, FW: PlayerApproach })
      .strict(),
    crowd: z
      .object({
        climate: z.enum(["apoio", "cobranca"]),
        intensity: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      })
      .strict(),
  })
  .strict();

export type MatchAiTacticalPlan = z.infer<typeof TacticalPlan>;
export interface MatchAiSummary {
  homeStrength: number;
  awayStrength: number;
  difficulty: Difficulty;
  homeAttributes?: number[];
  awayAttributes?: number[];
  homeRoles?: Array<{ position: string; attributes: number[] }>;
  awayRoles?: Array<{ position: string; attributes: number[] }>;
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
              "Choose the away team's football tactics and both teams' player approaches by position for a simulator. Inputs are catalog-derived ratings 0-100 and difficulty. Team and position attribute arrays are averages in order pace, shooting, passing, defending, physical. The controls are mentality 0-4 and pressing, width and tempo 0-2. For each position choose cautious, balanced or attacking; players are away and homePlayers are home. Also choose a plausible home crowd climate and intensity; crowd reactions remain driven by match events. Return only the requested structured plan.",
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
                players: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    GK: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                    DF: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                    MF: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                    FW: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                  },
                  required: ["GK", "DF", "MF", "FW"],
                },
                homePlayers: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    GK: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                    DF: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                    MF: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                    FW: { type: "string", enum: ["cautious", "balanced", "attacking"] },
                  },
                  required: ["GK", "DF", "MF", "FW"],
                },
                crowd: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    climate: { type: "string", enum: ["apoio", "cobranca"] },
                    intensity: { type: "integer", enum: [0, 1, 2] },
                  },
                  required: ["climate", "intensity"],
                },
              },
              required: [
                "mentality",
                "pressing",
                "width",
                "tempo",
                "players",
                "homePlayers",
                "crowd",
              ],
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
