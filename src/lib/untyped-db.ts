import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The generated database types lag behind tables and functions this code relies on
 * (added by migrations not yet present on the connected backend). Use this only at
 * those call sites; runtime errors from missing objects are still checked and surfaced.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedDb = SupabaseClient<any, any, any>;

export function untypedDb(client: unknown): UntypedDb {
  return client as UntypedDb;
}
