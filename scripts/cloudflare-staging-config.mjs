import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const PROJECT_REF = "skycnsjbcqmsaejaairl";
const SUPABASE_URL = "https://skycnsjbcqmsaejaairl.supabase.co";
const SITE_URL = "https://app-staging.jogomanager.com";
const ACCOUNT_ID = "31b4ec9dfe5281c893ccfaaaefcfc88d";
const BUILD_KEYS = [
  "main",
  "assets",
  "compatibility_date",
  "compatibility_flags",
  "rules",
  "no_bundle",
  "find_additional_modules",
  "upload_source_maps",
  "minify",
  "observability",
];
const REPLACED_KEYS = [
  "$schema",
  "name",
  "vars",
  "routes",
  "route",
  "workers_dev",
  "preview_urls",
  "keep_vars",
  "account_id",
  "send_metrics",
];

// Derive a private staging configuration from a generated Nitro Worker package.
// No production routes, inherited vars, or resource bindings can survive this step.
export function stagingWorkerConfig(base, env) {
  if (
    env.VITE_SUPABASE_URL !== SUPABASE_URL ||
    (env.SUPABASE_URL && env.SUPABASE_URL !== SUPABASE_URL) ||
    (env.VITE_SUPABASE_PROJECT_ID && env.VITE_SUPABASE_PROJECT_ID !== PROJECT_REF)
  ) {
    throw new Error("Staging must use its isolated Supabase project.");
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? "") ||
    (env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_PUBLISHABLE_KEY !== key)
  ) {
    throw new Error("Staging requires a matching publishable Supabase key, never a service key.");
  }
  const token = env.VITE_PAYMENTS_CLIENT_TOKEN;
  if (
    !/^pk_test_[A-Za-z0-9_]+$/.test(token ?? "") ||
    (env.PAYMENTS_ENVIRONMENT && env.PAYMENTS_ENVIRONMENT !== "sandbox")
  ) {
    throw new Error("Staging requires a Stripe test publishable key and sandbox mode.");
  }
  if (
    (env.SITE_URL && env.SITE_URL !== SITE_URL) ||
    env.CLOUDFLARE_SITE_ZONE ||
    (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT_ID)
  ) {
    throw new Error("Staging cannot inherit a production domain or another Cloudflare account.");
  }
  for (const name of Object.keys(base)) {
    if (!BUILD_KEYS.includes(name) && !REPLACED_KEYS.includes(name)) {
      throw new Error(`Unreviewed Worker configuration field: ${name}`);
    }
  }
  if (typeof base.main !== "string" || !base.assets || base.assets.binding !== "ASSETS") {
    throw new Error("Expected the generated Nitro Worker and ASSETS binding.");
  }
  const config = Object.fromEntries(
    BUILD_KEYS.filter((name) => name in base).map((name) => [name, base[name]]),
  );
  return {
    ...config,
    name: "jogomanager-web-staging",
    account_id: ACCOUNT_ID,
    routes: [],
    workers_dev: false,
    preview_urls: false,
    keep_vars: false,
    send_metrics: false,
    vars: {
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: key,
      VITE_PAYMENTS_CLIENT_TOKEN: token,
      SITE_URL,
      PAYMENTS_ENVIRONMENT: "sandbox",
      GUEST_CHECKOUT_ENVIRONMENT: "sandbox",
      GUEST_CHECKOUT_SANDBOX_ENABLED: "false",
      GUEST_CHECKOUT_LIVE_ENABLED: "false",
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [source, destination] = process.argv.slice(2);
    if (!source || !destination || path.resolve(source) === path.resolve(destination)) {
      throw new Error(
        "Usage: node scripts/cloudflare-staging-config.mjs <generated-config> <new-staging-config>",
      );
    }
    // Keep relative module and asset paths valid, and never overwrite the source.
    if (path.dirname(path.resolve(source)) !== path.dirname(path.resolve(destination))) {
      throw new Error("The staging configuration must be next to the generated configuration.");
    }
    const config = stagingWorkerConfig(JSON.parse(await readFile(source, "utf8")), process.env);
    await writeFile(destination, `${JSON.stringify(config, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log("Private staging Worker configuration generated; no deployment performed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Staging configuration failed.");
    process.exitCode = 1;
  }
}
