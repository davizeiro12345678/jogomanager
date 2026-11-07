// Ensure runtime credentials are not committed and the public config template
// remains usable. Real values belong in Cloudflare, Supabase and CI secrets.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const forbiddenFiles = [".env", ".env.development", ".env.production"];
const tracked = execFileSync("git", ["ls-files", "--", ...forbiddenFiles], {
  encoding: "utf8",
}).trim();
if (tracked) {
  throw Error("Runtime .env files must not be tracked by Git");
}

const template = readFileSync(".env.example", "utf8");
const present = new Set();
for (const [index, original] of template.split(/\r?\n/).entries()) {
  const line = original.trim();
  if (!line || line.startsWith("#")) continue;
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match) {
    throw Error(`.env.example:${index + 1}: invalid declaration`);
  }
  const [, key, quoted] = match;
  const value = quoted.replace(/^(['"])(.*)\1$/, "$2");
  present.add(key);
  if (
    /^(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|FASTLY_API_TOKEN|TWILIO_AUTH_TOKEN)$/i.test(
      key,
    )
  ) {
    throw Error(`.env.example:${index + 1}: server secret must not be in a public template`);
  }
  if (/^(?:sk_live_|sk_test_|sb_secret_|github_pat_|ghp_|whsec_)[A-Za-z0-9_-]{12,}/i.test(value)) {
    throw Error(`.env.example:${index + 1}: potential credential value`);
  }
}

const required = [
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_AUTH_MODE",
  "VITE_PAYMENTS_CLIENT_TOKEN",
  "PAYMENTS_ENVIRONMENT",
];
for (const key of required) {
  if (!present.has(key)) throw Error(`.env.example: missing ${key}`);
}

console.log("Runtime .env files are untracked; public template validation: PASS");
