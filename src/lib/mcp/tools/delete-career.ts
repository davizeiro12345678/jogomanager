import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_career",
  title: "Delete manager career",
  description: "Permanently delete the signed-in user's saved Manager 3D career.",
  inputSchema: {},
  annotations: { readOnlyHint: false, destructiveHint: true },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("careers").delete().eq("user_id", ctx.getUserId());
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : {
          content: [{ type: "text", text: "Career deleted." }],
          structuredContent: { ok: true },
        };
  },
});
