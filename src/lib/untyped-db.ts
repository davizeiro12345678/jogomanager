import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export type UntypedDb = SupabaseClient<Database>;
export function untypedDb(client: unknown): UntypedDb {
  return client as UntypedDb;
}
