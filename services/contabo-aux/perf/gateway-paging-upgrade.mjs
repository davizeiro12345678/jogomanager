/**
 * Opt-in source patch for the public JogoManager VPS gateway.
 * No changes unless --apply and JM_APPROVE_CATALOG_PAGING=YES are supplied.
 */
import { copyFileSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";

const TARGET = "/srv/jogomanager/public-gateway/gateway.mjs";

export function upgradeCatalogPagination(source) {
  if (typeof source !== "string") throw new TypeError("Expected string");
  const edits = [
    ["!/^(0|[1-9]\\d{0,2})$/.test(strLimit)", "!/^(0|[1-9]\\d{0,3})$/.test(strLimit)"],
    [
      "if (page > 1000 || limit < 1 || limit > 100)",
      "if (page > 1000 || limit < 1 || limit > 1_000 || page * limit > 50_000)",
    ],
  ];
  let updated = source;
  for (const [before, after] of edits) {
    if (!updated.includes(before) || updated.split(before).length !== 2)
      throw new Error("incompatible_gateway_source: refusing silent changes");
    updated = updated.replace(before, after);
  }
  // Add a versioned, smaller public projection. Original /clubs contract remains untouched.
  function once(text, from, to) {
    if (text.split(from).length !== 2) throw new Error("unexpected_gateway_shape");
    return text.replace(from, to);
  }
  updated = once(
    updated,
    "async function publicPage(page, limit) {",
    "async function publicPage(page, limit, crestsOnly = false) {",
  );
  updated = once(
    updated,
    'url.searchParams.set("select", "id,name,crest_url");',
    'url.searchParams.set("select", crestsOnly ? "id,crest_url" : "id,name,crest_url");',
  );
  updated = once(
    updated,
    "function refreshInBackground(id, page, limit) {",
    "function refreshInBackground(id, page, limit, crestsOnly = false) {",
  );

  function upgradeSection(text, opening, closing, change) {
    const from = text.indexOf(opening),
      to = text.indexOf(closing);
    if (from < 0 || to < from) throw new Error("unexpected_gateway_section");
    return text.slice(0, from) + change(text.slice(from, to)) + text.slice(to);
  }
  updated = upgradeSection(
    updated,
    "function refreshInBackground(",
    "async function prewarm(",
    (section) => once(section, "publicPage(page, limit)", "publicPage(page, limit, crestsOnly)"),
  );
  updated = upgradeSection(
    updated,
    "async function prewarm(",
    "function prewarmOnBoot(",
    (section) =>
      once(section, 'const id = page + ":" + limit;', 'const id = "clubs:" + page + ":" + limit;'),
  );
  updated = upgradeSection(
    updated,
    'if (req.method === "GET" && u.pathname === "/v1/public/clubs")',
    'if (req.method === "POST" && u.pathname === "/v1/events/click")',
    (section) => {
      let changed = once(
        section,
        'if (req.method === "GET" && u.pathname === "/v1/public/clubs") {',
        'if (req.method === "GET" && (u.pathname === "/v1/public/clubs" || u.pathname === "/v1/public/crests")) {\n    const crestsOnly = u.pathname === "/v1/public/crests";',
      );
      changed = once(
        changed,
        'const id = page + ":" + limit;',
        'const id = (crestsOnly ? "crests:" : "clubs:") + page + ":" + limit;',
      );
      if (changed.split("refreshInBackground(id, page, limit)").length !== 3)
        throw new Error("unexpected_refresh_call_count");
      changed = changed.replaceAll(
        "refreshInBackground(id, page, limit)",
        "refreshInBackground(id, page, limit, crestsOnly)",
      );
      return once(
        changed,
        "p = publicPage(page, limit);",
        "p = publicPage(page, limit, crestsOnly);",
      );
    },
  );

  if (!updated.includes('u.pathname === "/v1/public/crests"'))
    throw new Error("missing_canonical_crests_route");
  if (!updated.includes("MAX_ITEM_BYTES = 160 * 1024"))
    throw new Error("unexpected max-item-size contract");
  return updated;
}

if (process.argv[1]?.endsWith("/gateway-paging-upgrade.mjs")) {
  const [mode, path] = process.argv.slice(2);
  if (!["--check", "--apply"].includes(mode) || path !== TARGET)
    throw new Error("Usage: node gateway-paging-upgrade.mjs --check|--apply " + TARGET);
  const existing = readFileSync(path, "utf8");
  const next = upgradeCatalogPagination(existing);
  console.log("Validated: 1000 rows/page, offset work cap 50000.");
  if (mode === "--apply") {
    if (process.env.JM_APPROVE_CATALOG_PAGING !== "YES")
      throw new Error("JM_APPROVE_CATALOG_PAGING=YES required");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path + ".pre-paging-" + stamp + ".bak";
    const temp = join(dirname(path), ".catalog-paging-" + stamp + ".mjs");
    const oldMode = statSync(path).mode & 0o777;
    writeFileSync(temp, next, { mode: oldMode, flag: "wx" });
    execFileSync(process.execPath, ["--check", temp], { stdio: "pipe" });
    copyFileSync(path, backup);
    renameSync(temp, path);
    console.log("File updated, backup:", backup);
    console.log("No containers restarted; validate in canary before deployment.");
  }
}
