// Ensures checked-in configuration contains public, internally consistent values only.
// This validates shape; real provider authentication still requires an integration smoke test.
import { readFileSync } from "node:fs";

const PROJECT_ID = "lguqnwvsfeefxamzeyos";
const PUBLIC_URL = `https://${PROJECT_ID}.supabase.co`;

function readEnv(filename) {
  const result = new Map();
  for (const [index, original] of readFileSync(filename, "utf8").split(/\r?\n/).entries()) {
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) throw Error(`${filename}:${index + 1}: invalid environment declaration`);
    if (result.has(match[1])) {
      throw Error(`${filename}:${index + 1}: duplicate variable ${match[1]}`);
    }
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    result.set(match[1], value);
    if (/^sk_(?:live|test)_|^sb_secret_|^gh[pousr]_|^github_pat_|^whsec_/i.test(value)) {
      throw Error(`${filename}:${index + 1}: private credential in tracked configuration`);
    }
    if (
      /^(?:SUPABASE_SERVICE_ROLE_KEY|FASTLY_API_TOKEN|TWILIO_AUTH_TOKEN|STRIPE_SECRET_KEY|STRIPE_LIVE_API_KEY)$/i.test(
        match[1],
      )
    ) {
      throw Error(`${filename}:${index + 1}: secret variable name must not be committed`);
    }
  }
  return result;
}

const shared = readEnv(".env");
const dev = readEnv(".env.development");
const prod = readEnv(".env.production");
for (const prefix of ["", "VITE_"]) {
  if (shared.get(`${prefix}SUPABASE_URL`) !== PUBLIC_URL) {
    throw Error(`.env: ${prefix}SUPABASE_URL must match live project URL`);
  }
  if (shared.get(`${prefix}SUPABASE_PROJECT_ID`) !== PROJECT_ID) {
    throw Error(`.env: ${prefix}SUPABASE_PROJECT_ID must match live project`);
  }
  if (
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(shared.get(`${prefix}SUPABASE_PUBLISHABLE_KEY`) ?? "")
  ) {
    throw Error(`.env: ${prefix}SUPABASE_PUBLISHABLE_KEY is not a publishable Supabase key`);
  }
}
if (shared.get("SUPABASE_PUBLISHABLE_KEY") !== shared.get("VITE_SUPABASE_PUBLISHABLE_KEY")) {
  throw Error(".env: server and client Supabase publishable keys must match");
}
for (const [name, vars, stripeMode, prefix] of [
  ["development", dev, "sandbox", "pk_test_"],
  ["production", prod, "live", "pk_live_"],
]) {
  if (!vars.get("VITE_PAYMENTS_CLIENT_TOKEN")?.startsWith(prefix)) {
    throw Error(`.env.${name}: Stripe publishable key does not match ${stripeMode}`);
  }
  if (vars.get("VITE_AUTH_MODE") !== "supabase") {
    throw Error(`.env.${name}: VITE_AUTH_MODE must be supabase`);
  }
  if (
    vars.get("PAYMENTS_ENVIRONMENT") !== stripeMode ||
    vars.get("GUEST_CHECKOUT_ENVIRONMENT") !== stripeMode
  ) {
    throw Error(`.env.${name}: payment environments must match the publishable key`);
  }
  if (
    vars.get(`GUEST_CHECKOUT_${name === "production" ? "LIVE" : "SANDBOX"}_ENABLED`) !== "false"
  ) {
    throw Error(`.env.${name}: guest checkout must stay disabled until secret-backed verification`);
  }
}
console.log("Public .env formats and consistency: PASS (no secret values printed)");
