import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MatchAiTacticalPlan } from "@/lib/match-ai.server";

const Input = z
  .object({
    homeClub: z.string().min(1).max(80),
    awayClub: z.string().min(1).max(80),
    difficulty: z.enum(["facil", "normal", "dificil"]),
  })
  .strict();

export const requestAiTacticalPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => Input.parse(value))
  .handler(async ({ data, context }): Promise<MatchAiTacticalPlan | null> => {
    if (process.env["MATCH_AI_OPENAI_ENABLED"] !== "true") return null;
    const key = process.env["OPENAI_API_KEY"]?.trim();
    if (!key) return null;
    const { CLUBS } = await import("@/game/data/leagues");
    if (!Object.hasOwn(CLUBS, data.homeClub) || !Object.hasOwn(CLUBS, data.awayClub)) return null;
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`match-ai:${context.userId}`),
      );
      const token = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: allowed, error } = await supabaseAdmin.rpc("reserve_guest_checkout_attempt", {
        _email_hash: token,
      });
      if (error || allowed !== true) return null;
      const { reserveAiBudget } = await import("@/lib/ai-budget.server");
      // Conservative reservation for 25k output tokens; this remains an estimate,
      // not an OpenAI invoice or a hard currency cap.
      if (!(await reserveAiBudget("text", 200))) return null;
      const { buildTeamSetup } = await import("@/game/quickMatch");
      const attributes = (club: string) => {
        const players = buildTeamSetup(club).players;
        return (["pace", "shooting", "passing", "defending", "physical"] as const).map(
          (attribute) =>
            Math.round(
              players.reduce((sum, player) => sum + player[attribute], 0) /
                Math.max(1, players.length),
            ),
        );
      };
      const { requestMatchTactics } = await import("@/lib/match-ai.server");
      return requestMatchTactics(key, {
        homeStrength: CLUBS[data.homeClub]!.strength,
        awayStrength: CLUBS[data.awayClub]!.strength,
        difficulty: data.difficulty,
        homeAttributes: attributes(data.homeClub),
        awayAttributes: attributes(data.awayClub),
      });
    } catch {
      return null;
    }
  });
