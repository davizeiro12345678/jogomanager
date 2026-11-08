import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { CareerState } from "@/game/types";
import { parseCareerSaveRequest } from "@/lib/career-input";

export default defineTool({
  name: "save_career",
  title: "Save manager career",
  description:
    "Update an existing signed-in Manager 3D career at its observed generation, preserving newer progress and rejecting deleted or replaced careers.",
  inputSchema: {
    state: z
      .record(z.string(), z.unknown())
      .describe("Full career state object as used by the game."),
    expectedGeneration: z.number().int().positive().describe("Generation returned by get_career."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async ({ state, expectedGeneration }, ctx) => {
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
      const input = parseCareerSaveRequest({
        state,
        expectedGeneration,
        expectedOwnerId: userId,
      });
      const { saveValidatedCareer } = await import("@/lib/career-save.server");
      // MCP imports remain personal saves; they cannot attest official progress.
      const result = await saveValidatedCareer(
        userId,
        input.state as unknown as CareerState,
        false,
        input.expectedGeneration ?? null,
      );
      if (!result.ok) {
        const message =
          "deleted" in result
            ? "This career was deleted. Read the current career before creating a new one."
            : "stale" in result && result.stale
              ? "Newer career progress is already saved. Read the current career before updating it."
              : "Career generation changed. Read the current career before retrying.";
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { ok: false, result },
          isError: true,
        };
      }
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
