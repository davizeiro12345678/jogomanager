import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadEnv } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = path.join(root, ".cloudflare/production/server/wrangler.json");
const settings = { ...loadEnv("production", root, ""), ...process.env };
const taskEnv = {
  ...process.env,
  WRANGLER_LOG_PATH: path.join(root, ".wrangler/logs"),
  XDG_CONFIG_HOME: process.env["XDG_CONFIG_HOME"] || path.join(root, ".wrangler/config"),
};
const action = process.argv[2] ?? "check";

function runNode(relative, args, capture = false, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, relative), ...args], {
      cwd: root,
      env: { ...taskEnv, ...extraEnv },
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    let stdout = "";
    if (capture) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", () => undefined);
    }
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`Command failed (${code}): ${relative}`)),
    );
  });
}
const wrangler = (args, capture = false) =>
  runNode("node_modules/wrangler/bin/wrangler.js", args, capture);

async function prepare() {
  await access(path.join(root, ".cloudflare/production/server/index.mjs"));
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const url = settings["SUPABASE_URL"] || settings["VITE_SUPABASE_URL"];
  const publicUrl = settings["VITE_SUPABASE_URL"] || url;
  const publicKey =
    settings["SUPABASE_PUBLISHABLE_KEY"] || settings["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publicKey)
    throw new Error("Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before deployment.");
  if (new URL(url).origin !== new URL(publicUrl).origin)
    throw new Error("Server and browser Supabase projects must match.");
  if (publicKey.startsWith("sb_secret_"))
    throw new Error("A Supabase secret key cannot be used as a publishable key.");
  if (publicKey.startsWith("eyJ")) {
    const claims = JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString());
    if (claims.role !== "anon") throw new Error("The browser key must have the anon role.");
    if (claims.ref && !new URL(url).hostname.startsWith(`${claims.ref}.`))
      throw new Error("Supabase URL and publishable key belong to different projects.");
  }
  const vars = {
    ...config.vars,
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: publicKey,
    SITE_URL: settings["SITE_URL"] || "https://jogomanager.com",
  };
  for (const name of [
    "VITE_PAYMENTS_CLIENT_TOKEN",
    "PAYMENTS_ENVIRONMENT",
    "GUEST_CHECKOUT_ENVIRONMENT",
    "GUEST_CHECKOUT_ENABLED",
    "GUEST_CHECKOUT_LIVE_ENABLED",
    "AI_API_URL",
    "AI_MODEL",
    "TRANSACTIONAL_EMAIL_PROVIDER",
    "TRANSACTIONAL_EMAIL_FROM",
  ]) {
    if (settings[name]) vars[name] = settings[name];
  }
  config.vars = vars;
  config.name = "jogomanager-web";
  if (settings["CLOUDFLARE_ACCOUNT_ID"]) config.account_id = settings["CLOUDFLARE_ACCOUNT_ID"];
  config.keep_vars = true;
  config.workers_dev = true;
  config.compatibility_date = "2026-10-02";
  config.observability = { enabled: true };
  const siteZone = settings["CLOUDFLARE_SITE_ZONE"];
  if (siteZone) {
    if (!/^[a-z0-9.-]+$/.test(siteZone) || siteZone.includes(".."))
      throw new Error("CLOUDFLARE_SITE_ZONE must be a domain name, without protocol or path.");
    // The custom domain serves every apex path. Avoid running this same Worker
    // both as a route and as the origin. Separate sports-import routes stay intact.
    config.routes = [
      { pattern: siteZone, custom_domain: true },
      { pattern: `www.${siteZone}/*`, zone_name: siteZone },
    ];
  }
  // Keep Nitro's module rules/assets configuration. Never add secret values to vars.
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(
    `Cloudflare package prepared: ${config.name}. Browser and server use the same Supabase project.`,
  );
}

try {
  await mkdir(path.join(root, ".wrangler/logs"), { recursive: true });
  if (action === "build" || action === "deploy") {
    await runNode("node_modules/vite/bin/vite.js", ["build"], false, {
      VITE_AUTH_MODE: settings["VITE_AUTH_MODE"] || "supabase",
      NITRO_PRESET: "cloudflare-module",
      PFM_CLOUDFLARE_BUILD: "1",
    });
  }
  await prepare();
  if (action === "check") await wrangler(["deploy", "--config", configPath, "--dry-run"]);
  else if (action === "deploy") {
    await wrangler(["whoami"]);
    const raw = await wrangler(["secret", "list", "--config", configPath], true);
    const names = new Set(JSON.parse(raw).map((secret) => secret.name));
    if (!names.has("SUPABASE_SERVICE_ROLE_KEY"))
      throw new Error(
        "Deployment blocked: add SUPABASE_SERVICE_ROLE_KEY to the jogomanager-web Worker using wrangler secret put. Career saves and purchases require it.",
      );
    await wrangler(["deploy", "--config", configPath]);
  } else if (action !== "build" && action !== "prepare")
    throw new Error(`Unknown action: ${action}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Cloudflare command failed.");
  process.exitCode = 1;
}
