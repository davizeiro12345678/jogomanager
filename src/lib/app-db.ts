import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Database client typed against the generated schema. */
export type AppDb = SupabaseClient<Database>;
