import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppDb } from "./app-db";

export function publicClient(): AppDb {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Os dados públicos de futebol estão indisponíveis.");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** A server-configured row cap can be smaller than our requested page size. */
export async function readPublicPages<T extends { id: string }>(
  load: (cursor: string | undefined) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = 100_000,
): Promise<T[]> {
  const rows: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < Math.min(maxRows + 1, 2_048); page++) {
    const result = await load(cursor);
    if (result.error || !result.data)
      throw new Error("Não foi possível carregar os dados completos de futebol.");
    if (result.data.length === 0) return rows;
    const next = result.data.at(-1)!.id;
    if (!next || cursors.has(next) || rows.length + result.data.length > maxRows)
      throw new Error("A paginação dos dados de futebol excedeu o limite seguro.");
    rows.push(...result.data);
    cursors.add(next);
    cursor = next;
  }
  throw new Error("A paginação dos dados de futebol excedeu o limite seguro.");
}
