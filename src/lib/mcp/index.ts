import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getCareerTool from "./tools/get-career";
import saveCareerTool from "./tools/save-career";
import deleteCareerTool from "./tools/delete-career";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "pro-football-manager-3d",
  title: "Pro Football Manager 3D",
  version: "0.1.0",
  instructions:
    "Tools for Pro Football Manager 3D, a 3D football management game. Use `get_career` to read the signed-in user's saved career, `save_career` to update it, and `delete_career` to remove it.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // exactOptionalPropertyTypes: tools without an explicit outputSchema
  // otherwise fail AnyToolDefinition assignability.
  tools: [getCareerTool, saveCareerTool, deleteCareerTool] as never[],
});
