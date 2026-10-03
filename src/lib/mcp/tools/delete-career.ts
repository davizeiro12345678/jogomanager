import { defineTool } from "@lovable.dev/mcp-js";

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
    const userId = ctx.getUserId();
    if (!userId)
      return {
        content: [{ type: "text", text: "Not authenticated" }],
        isError: true,
      };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("careers").delete().eq("user_id", userId);
    return error
      ? {
          content: [{ type: "text", text: "Career deletion is unavailable through this tool." }],
          isError: true,
        }
      : {
          content: [{ type: "text", text: "Career deleted." }],
          structuredContent: { ok: true },
        };
  },
});
