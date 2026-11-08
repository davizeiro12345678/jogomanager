// Ensure runtime credentials are not committed and the public config template
// remains usable. Real values belong in Cloudflare, Supabase and CI secrets.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const forbiddenFiles = [".env", ".env.development", ".env.production"];
const tracked = execFileSync("git", ["ls-files", "--", ...forbiddenFiles], {
  encoding: "utf8",
}).trim();
if (tracked) {
  throw Error("Runtime .env files must not be tracked by Git");
}

const template = readFileSync(".env.example", "utf8");
const present = new Set();
const forbiddenKeyName = /(?:^|_)(?:SERVICE_ROLE|SECRET|PRIVATE)(?:_|$)/i;
for (const [index, original] of template.split(/\r?\n/).entries()) {
  const line = original.trim();
  if (!line || line.startsWith("#")) continue;
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match) {
    throw Error(`.env.example:${index + 1}: invalid declaration`);
  }
  const [, key, quoted] = match;
  const value = quoted.replace(/^(['"])(.*)\1$/, "$2");
  if (present.has(key)) {
    throw Error(`.env.example:${index + 1}: duplicate declaration for ${key}`);
  }
  present.add(key);
  if (
    /^(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|FASTLY_API_TOKEN|TWILIO_AUTH_TOKEN)$/i.test(
      key,
    ) ||
    forbiddenKeyName.test(key)
  ) {
    throw Error(`.env.example:${index + 1}: server secret must not be in a public template`);
  }
  if (/^(?:sk_live_|sk_test_|sb_secret_|github_pat_|ghp_|whsec_)[A-Za-z0-9_-]{12,}/i.test(value)) {
    throw Error(`.env.example:${index + 1}: potential credential value`);
  }
}

const required = [
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_AUTH_MODE",
  "VITE_PAYMENTS_CLIENT_TOKEN",
  "PAYMENTS_ENVIRONMENT",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
];
for (const key of required) {
  if (!present.has(key)) throw Error(`.env.example: missing ${key}`);
}

const bundleForbiddenPatterns = [
  { label: "Supabase service-role key", pattern: /\bSUPABASE_SERVICE_ROLE_KEY\b/i },
  { label: "service-role credential", pattern: /\bservice[-_]role\b/i },
  {
    label: "server-only secret identifier",
    pattern: /\b[A-Z][A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE)[A-Z0-9_]*\b/,
  },
  { label: "Supabase secret credential", pattern: /\bsb_secret_[A-Za-z0-9_-]{8,}\b/i },
  { label: "server credential", pattern: /\b(?:sk_(?:live|test)_|whsec_)[A-Za-z0-9_-]{8,}\b/i },
];
const bundleTextFile = /\.(?:cjs|css|html|js|json|map|mjs|txt)$/i;

function listBundleFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listBundleFiles(file));
    else if (entry.isFile() && bundleTextFile.test(entry.name)) files.push(file);
  }
  return files;
}

function resolveBundleDirectory() {
  const optionIndex = process.argv.indexOf("--bundle-dir");
  if (optionIndex !== -1) {
    const directory = process.argv[optionIndex + 1]?.trim();
    if (!directory || directory.startsWith("--")) {
      throw Error("Missing value for --bundle-dir");
    }
    return directory;
  }
  const configured = process.env["PUBLIC_BUNDLE_DIR"]?.trim();
  if (configured) return configured;
  return [".output/public", "dist"].find((directory) => existsSync(directory));
}

function validatePublicBundle(directory) {
  if (!existsSync(directory)) throw Error("Public bundle directory does not exist");
  for (const file of listBundleFiles(directory)) {
    const source = readFileSync(file, "utf8");
    const match = bundleForbiddenPatterns.find(({ pattern }) => pattern.test(source));
    if (match) {
      throw Error(`Public bundle contains ${match.label}; server-only values must not ship`);
    }
  }
}

console.log("Runtime .env files are untracked; public template validation: PASS");
const bundleDirectory = resolveBundleDirectory();
if (bundleDirectory) {
  validatePublicBundle(bundleDirectory);
  console.log("Public bundle server-secret scan: PASS");
}
