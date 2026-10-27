import { test } from "node:test";
import { strict as assert } from "node:assert";
import { upgradeCatalogPagination } from "./gateway-paging-upgrade.mjs";

const baseline = [
  "const MAX_BYTES = 32 * 1024 * 1024, MAX_ITEM_BYTES = 160 * 1024, TTL_MS = 300000;",
  "async function publicPage(page, limit) {",
  'url.searchParams.set("select", "id,name,crest_url");',
  "}",
  "function refreshInBackground(id, page, limit) {",
  "const task = publicPage(page, limit)",
  "}",
  "async function prewarm(page, limit) {",
  'const id = page + ":" + limit;',
  "const task = publicPage(page, limit)",
  "}",
  "function prewarmOnBoot() {}",
  'if (req.method === "GET" && u.pathname === "/v1/public/clubs") {',
  "if (!/^(0|[1-9]\\d{0,3})$/.test(strPage) || !/^(0|[1-9]\\d{0,2})$/.test(strLimit)) {}",
  "if (page > 1000 || limit < 1 || limit > 100) {}",
  'const id = page + ":" + limit;',
  "refreshInBackground(id, page, limit)",
  "refreshInBackground(id, page, limit)",
  "p = publicPage(page, limit);",
  "}",
  'if (req.method === "POST" && u.pathname === "/v1/events/click") {}',
].join("\n");
test("expands page size but keeps bounded offset", () => {
  const updated = upgradeCatalogPagination(baseline);
  assert.match(updated, /limit > 1_000/);
  assert.match(updated, /page \* limit > 50_000/);
  assert.match(updated, /MAX_ITEM_BYTES = 160 \* 1024/);
  assert.match(updated, /id,crest_url/);
  assert.match(updated, /crestsOnly/);
  assert.match(updated, /\/v1\/public\/crests/);
});
test("refuses already patched or incompatible versions", () => {
  const updated = upgradeCatalogPagination(baseline);
  assert.throws(() => upgradeCatalogPagination(updated), /incompatible_gateway_source/);
  assert.throws(() => upgradeCatalogPagination("irrelevant"), /incompatible_gateway_source/);
});
