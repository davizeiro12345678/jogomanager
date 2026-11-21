import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_PROJECT_REF = "lguqnwvsfeefxamzeyos";

export function productionSupabaseConfig(env) {
  const ref = env.EXPECTED_PRODUCTION_SUPABASE_REF || DEFAULT_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(ref))
    throw new Error("Invalid expected production Supabase project ref.");
  if (env.VITE_SUPABASE_PROJECT_ID && env.VITE_SUPABASE_PROJECT_ID !== ref)
    throw new Error("The browser Supabase project ID does not match the expected project.");
  const rawUrl = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("The browser Supabase URL is missing or invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.host !== `${ref}.supabase.co` ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("The browser Supabase URL does not identify the expected production project.");
  if (!key || key.startsWith("sb_secret_"))
    throw new Error("A publishable Supabase key is required.");
  if (key.startsWith("eyJ")) {
    let claims;
    try {
      claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    } catch {
      throw new Error("The legacy browser key is invalid.");
    }
    if (claims.role !== "anon" || (claims.ref && claims.ref !== ref))
      throw new Error("The legacy browser key is not an anon key for the expected project.");
  } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("The browser Supabase key has an invalid format.");
  }
  if (env.SUPABASE_URL && new URL(env.SUPABASE_URL).href !== `${url.origin}/`)
    throw new Error("Server and browser Supabase projects differ.");
  if (env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_PUBLISHABLE_KEY !== key)
    throw new Error("Server and browser publishable Supabase keys differ.");
  return { url: url.origin, key };
}

export async function verifyProductionSupabase(env, fetchImpl = fetch) {
  const config = productionSupabaseConfig(env);
  let response;
  try {
    response = await fetchImpl(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error("Could not verify production Supabase connectivity.");
  }
  if (!response.ok)
    throw new Error(`Production Supabase rejected the public key (HTTP ${response.status}).`);
  return config;
}

// The Worker and the browser can differ even if their deployment variables match:
// Vite substitutes the browser values at build time. Inspect the built client.
export async function verifyBrowserSupabaseBundle(assetDir, config) {
  const files = await readdir(assetDir, { withFileTypes: true });
  const clients = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".js")) continue;
    const contents = await readFile(path.join(assetDir, file.name), "utf8");
    if (contents.includes("Missing Supabase environment variable")) clients.push(contents);
  }
  if (
    !clients.length ||
    clients.some((contents) => !contents.includes(config.url) || !contents.includes(config.key))
  )
    throw new Error(
      "The built browser Supabase client does not match the verified production configuration.",
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await verifyProductionSupabase(process.env);
    console.log("Production browser Supabase project and public key verified.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Supabase verification failed.");
    process.exitCode = 1;
  }
}
