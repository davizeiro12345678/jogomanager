import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { CareerState } from "@/game/types";
import { parseCareerInput } from "@/lib/career-input";

export default defineTool({
  name: "save_career",
  title: "Save manager career",
  description:
    "Create or update the signed-in user's Manager 3D career state, preserving newer saved season progress.",
  inputSchema: {
    state: z
      .record(z.string(), z.unknown())
      .describe("Full career state object as used by the game."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ state }, ctx) => {
    if (!ctx.isAuthenticated())
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    const userId = ctx.getUserId();
    if (!userId)
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    try {
      const input = parseCareerInput({ state });
      const { saveValidatedCareer } = await import("@/lib/career-save.server");
      // MCP imports remain personal saves; they cannot attest official progress.
      const result = await saveValidatedCareer(
        userId,
        input.state as unknown as CareerState,
        false,
      );
      if (result.stale)
        return {
          content: [
            {
              type: "text",
              text: "Newer career progress is already saved. Read the current career before updating it.",
            },
          ],
          structuredContent: { ok: false, stale: true },
          isError: true,
        };
      return {
        content: [{ type: "text", text: "Career saved." }],
        structuredContent: { ok: true },
      };
    } catch {
      return {
        content: [{ type: "text", text: "Career imports are unavailable through this tool." }],
        isError: true,
      };
    }
  },
});
