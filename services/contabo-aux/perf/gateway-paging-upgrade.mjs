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
    [
      "!/^(0|[1-9]\\d{0,2})$/.test(strLimit)",
      "!/^(0|[1-9]\\d{0,3})$/.test(strLimit)",
    ],
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
  if (!updated.includes('if (req.method === "GET" && u.pathname === "/v1/public/clubs")'))
    throw new Error("unexpected route layout");
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
