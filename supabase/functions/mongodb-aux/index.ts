// Supabase Auth remains authoritative. MongoDB stores auxiliary diagnostics only.
// No Stripe writes, wallet mutations, password storage, or trusted match results.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { MongoClient } from "npm:mongodb@6.21.0";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

let cachedClient: Promise<MongoClient> | undefined;
function getMongoClient(): Promise<MongoClient> {
  const uri = Deno.env.get("MONGODB_URI");
  if (!uri) throw new Error("NOT_CONFIGURED");
  // Each isolate uses a tiny pool to avoid exhausting Atlas Free (max 500).
  // In production, bound the total number of isolates as well.
  cachedClient ??= new MongoClient(uri, {
    maxPoolSize: 2,
    minPoolSize: 0,
    connectTimeoutMS: 2500,
    serverSelectionTimeoutMS: 3000,
  })
    .connect()
    .catch((err) => {
      cachedClient = undefined; // recover after a transient network outage
      throw err;
    });
  return cachedClient;
}

Deno.serve(async (req) => {
  // Requests must carry a genuine Supabase end-user access token.
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/health")) return json({ error: "not_found" }, 404);
  const auth = req.headers.get("authorization") ?? "";
  const token = /^Bearer (.+)$/i.exec(auth)?.[1];
  if (!token) return json({ error: "unauthorized" }, 401);
  const sbUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!sbUrl || !publishableKey) return json({ error: "server_not_ready" }, 503);
  try {
    const supabase = createClient(sbUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "cache-control": "no-store" } },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
  } catch {
    return json({ error: "identity_unavailable" }, 503);
  }
  if (!Deno.env.get("MONGODB_URI")) {
    // Fail closed. Never fall back to a hard-coded Atlas URL or admin credentials.
    return json({ ready: false, reason: "mongodb_secret_missing" }, 503);
  }
  try {
    const client = await getMongoClient();
    // A ping proves connection, not game capacity or transactional reliability.
    await client.db("jogomanager_aux").command({ ping: 1 });
    return json({ ready: true, database: "jogomanager_aux", mode: "diagnostic_only" });
  } catch {
    return json({ ready: false, reason: "mongodb_unreachable" }, 503);
  }
});
