import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getCareerTool from "./tools/get-career";
import saveCareerTool from "./tools/save-career";
import deleteCareerTool from "./tools/delete-career";

function projectRefFromSupabaseUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const hostname = new URL(value).hostname;
    return /^([a-z0-9]+)\.supabase\.co$/i.exec(hostname)?.[1];
  } catch {
    return undefined;
  }
}

// The Supabase URL is the source of truth for the auth issuer. Older local
// env files can retain a project ref after SUPABASE_URL has moved to a new
// production project, which would make MCP OAuth validate against the wrong
// issuer even though the app itself uses the correct Supabase client.
const projectRef =
  projectRefFromSupabaseUrl(import.meta.env["VITE_SUPABASE_URL"]) ??
  import.meta.env["VITE_SUPABASE_PROJECT_ID"] ??
  "project-ref-unset";

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
