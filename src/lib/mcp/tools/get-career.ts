import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_career",
  title: "Get manager career",
  description:
    "Read the signed-in user's saved Manager 3D career: club, league, season round, squad, tactics and standings state.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("careers")
      .select("state, updated_at")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error)
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    if (!data)
      return {
        content: [
          {
            type: "text",
            text: "No saved career. The user has not started a career yet.",
          },
        ],
      };
    return {
      content: [{ type: "text", text: JSON.stringify(data.state) }],
      structuredContent: { state: data.state, updatedAt: data.updated_at },
    };
  },
});
