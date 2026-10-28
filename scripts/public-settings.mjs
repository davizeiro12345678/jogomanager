import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const allowed = {
  shared: new Set([
    "SUPABASE_PROJECT_ID",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "VITE_SUPABASE_PROJECT_ID",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY",
    "VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY",
    "VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY",
    "VITE_LOVABLE_CONNECTOR_POSTHOG_PROJECT_ID",
    "VITE_LOVABLE_CONNECTOR_POSTHOG_REGION",
  ]),
  development: new Set([
    "VITE_PAYMENTS_CLIENT_TOKEN",
    "VITE_AUTH_MODE",
    "PAYMENTS_ENVIRONMENT",
    "GUEST_CHECKOUT_ENVIRONMENT",
    "GUEST_CHECKOUT_SANDBOX_ENABLED",
  ]),
  production: new Set([
    "VITE_PAYMENTS_CLIENT_TOKEN",
    "VITE_AUTH_MODE",
    "PAYMENTS_ENVIRONMENT",
    "GUEST_CHECKOUT_ENVIRONMENT",
    "GUEST_CHECKOUT_LIVE_ENABLED",
  ]),
};

function looksLikeSecret(value) {
  const candidate = value.trim();
  if (
    /^(?:sk-(?:proj-|svcacct-)?[\w-]{16,}|(?:sk|rk)_(?:live|test)_|sb_secret_|(?:gh[pousr]|github_pat)_|whsec_|xox[baprs]-)/i.test(
      candidate,
    )
  )
    return true;
  const parts = candidate.split(".");
  if (parts.length === 3 && parts[1] && candidate.startsWith("eyJ")) {
    try {
      const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      return ["service_role", "supabase_admin"].includes(claims.role);
    } catch {
      // Not a readable JWT; other validation remains responsible for its shape.
    }
  }
  return false;
}

export function validateBrowserEnv(env) {
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith("VITE_") || typeof value !== "string" || !value) continue;
    if (
      /(?:OPENAI_API_KEY|SECRET|PASSWORD|PRIVATE|SERVICE_ROLE|AUTH_TOKEN|ACCESS_TOKEN)/i.test(
        name,
      ) ||
      looksLikeSecret(value)
    ) {
      throw new Error(`Refusing to expose a possible private credential through ${name}.`);
    }
  }
}

export function loadPublicSettings(mode, root = defaultRoot) {
  const config = JSON.parse(readFileSync(path.join(root, "config/public-settings.json"), "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid public settings.");
  }
  for (const section of Object.keys(config)) {
    if (!Object.hasOwn(allowed, section)) throw new Error("Unapproved public settings section.");
  }
  for (const [section, names] of Object.entries(allowed)) {
    const vars = config[section];
    if (!vars || typeof vars !== "object" || Array.isArray(vars)) {
      throw new Error(`Missing public settings section: ${section}.`);
    }
    for (const [name, value] of Object.entries(vars)) {
      if (!names.has(name) || typeof value !== "string" || looksLikeSecret(value)) {
        throw new Error(`Unapproved or private value in public settings: ${section}/${name}.`);
      }
    }
    validateBrowserEnv(vars);
  }
  const shared = config.shared;
  const project = shared.SUPABASE_PROJECT_ID;
  if (
    !/^[a-z0-9]+$/.test(project ?? "") ||
    shared.VITE_SUPABASE_PROJECT_ID !== project ||
    shared.SUPABASE_URL !== `https://${project}.supabase.co` ||
    shared.VITE_SUPABASE_URL !== shared.SUPABASE_URL ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(shared.SUPABASE_PUBLISHABLE_KEY ?? "") ||
    shared.VITE_SUPABASE_PUBLISHABLE_KEY !== shared.SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error("Public Supabase project settings are inconsistent.");
  }
  for (const [section, modeName, prefix, flag] of [
    ["development", "sandbox", "pk_test_", "GUEST_CHECKOUT_SANDBOX_ENABLED"],
    ["production", "live", "pk_live_", "GUEST_CHECKOUT_LIVE_ENABLED"],
  ]) {
    const vars = config[section];
    if (
      !vars.VITE_PAYMENTS_CLIENT_TOKEN?.startsWith(prefix) ||
      vars.VITE_AUTH_MODE !== "supabase" ||
      vars.PAYMENTS_ENVIRONMENT !== modeName ||
      vars.GUEST_CHECKOUT_ENVIRONMENT !== modeName ||
      vars[flag] !== "false"
    ) {
      throw new Error(`Public ${section} payment settings are inconsistent.`);
    }
  }
  return { ...shared, ...(config[mode] ?? {}) };
}
