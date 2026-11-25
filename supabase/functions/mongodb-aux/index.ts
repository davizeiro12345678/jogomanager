// Auxiliary-only MongoDB Atlas integration.
// Supabase remains the authority for users, wallets, purchases and career saves.
// No user-supplied queries or untrusted match results are written to Atlas.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { MongoClient } from "npm:mongodb@6.21.0";
import postgres from "npm:postgres@3.4.7";

const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });

// Direct Postgres access is only used to read an already-encrypted Vault
// secret on the backend. No public SQL/RPC returns the MongoDB credential.
const pgUrl = Deno.env.get("SUPABASE_DB_URL");
const sql = pgUrl
  ? postgres(pgUrl, {
      max: 1,
      prepare: false,
      ssl: "require",
      connect_timeout: 3,
      idle_timeout: 5,
    })
  : null;

let mongoConnection: Promise<MongoClient> | undefined;
async function getMongo(): Promise<MongoClient> {
  if (!sql) throw new Error("POSTGRES_NOT_CONFIGURED");
  if (!mongoConnection) {
    mongoConnection = (async () => {
      const records = await sql`
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mongodb_aux_uri_production'
        limit 1
      `;
      const uri = records[0]?.decrypted_secret;
      if (typeof uri !== "string" || !uri.startsWith("mongodb+srv://")) {
        throw new Error("SECRET_NOT_CONFIGURED");
      }
      const client = new MongoClient(uri, {
        maxPoolSize: 1,
        minPoolSize: 0,
        connectTimeoutMS: 2500,
        serverSelectionTimeoutMS: 3000,
        waitQueueTimeoutMS: 2000,
        maxIdleTimeMS: 10_000,
        appName: "jogomanager-aux",
      });
      try {
        return await client.connect();
      } catch (e) {
        await client.close().catch(() => undefined);
        throw e;
      }
    })().catch((err) => {
      mongoConnection = undefined; // Allow retry after transient network failure.
      throw err;
    });
  }
  return mongoConnection;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/health")) return json({ error: "not_found" }, 404);

  // Defence in depth: gateway JWT verification AND getUser(token).
  const token = /^Bearer (.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey || !pgUrl) {
    return json({ ready: false, reason: "configuration_missing" }, 503);
  }

  try {
    const auth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
  } catch {
    return json({ ready: false, reason: "auth_unavailable" }, 503);
  }

  try {
    const db = (await getMongo()).db("jogomanager_aux");
    await db.command({ ping: 1 });
    return json({ ready: true, mode: "diagnostic_only", auth: "supabase" });
  } catch {
    // Do not leak URLs, usernames, passwords, hostnames or server errors.
    return json({ ready: false, reason: "auxiliary_database_unreachable" }, 503);
  }
});
