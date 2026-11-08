import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "delete_career",
  title: "Delete manager career",
  description:
    "Logically delete the signed-in user's saved Manager 3D career with a durable stale-save barrier.",
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
    try {
      const { deleteCareerByUser } = await import("@/lib/career-lifecycle.server");
      const tombstone = await deleteCareerByUser(userId);
      return {
        content: [{ type: "text", text: "Career deleted and protected from stale saves." }],
        structuredContent: { ok: true, ...tombstone },
      };
    } catch {
      return {
        content: [{ type: "text", text: "Career deletion is unavailable through this tool." }],
        isError: true,
      };
    }
  },
});
