import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "save_career",
  title: "Save manager career",
  description:
    "Create or overwrite the signed-in user's Manager 3D career state (club, squad, tactics, season progress).",
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
    const supabase = supabaseForUser(ctx);
    // MCP imports are personal saves only. They cannot write official progress.
    const { error } = await supabase
      .from("careers")
      .upsert({ user_id: ctx.getUserId(), state: state as never }, { onConflict: "user_id" });
    return error
      ? {
          content: [{ type: "text", text: "Career imports are unavailable through this tool." }],
          isError: true,
        }
      : {
          content: [{ type: "text", text: "Career saved." }],
          structuredContent: { ok: true },
        };
  },
});
