/**
 * Verify public discovery metadata without mutating CDN state.
 *
 * Local: node scripts/verify-public-discovery.mjs
 * After deployment: node scripts/verify-public-discovery.mjs --live
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CANONICAL = "https://jogomanager.com";
const SOURCE = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");
const normalize = (value) =>
  value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
const expected = normalize(SOURCE);
const digest = (value) => createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);

if (
  !expected.startsWith("# JogoManager") ||
  !expected.includes(`Site oficial e endereço canônico: ${CANONICAL}`)
) {
  throw new Error("public/llms.txt does not declare the expected site identity and canonical URL");
}
if (/(?:https?:\/\/)?(?:www\.)?futebolmanager\.xyz/i.test(expected)) {
  throw new Error("public/llms.txt still references a retired website domain");
}
const links = [...expected.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
if (
  links.some((link) => link.startsWith("https://jogomanager.com.") || link.includes("localhost"))
) {
  throw new Error("public/llms.txt contains a noncanonical or local link");
}
console.log(
  `Local llms.txt: SHA256 ${digest(expected)}; ${links.length} links; canonical ${CANONICAL}`,
);

if (process.argv.includes("--live")) {
  const get = async (url) => {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "cache-control": "no-cache", accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const finalURL = new URL(response.url);
    if (finalURL.hostname !== "jogomanager.com") {
      throw new Error(`Unexpected redirect to ${finalURL.hostname}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^text\/plain(?:\s*;|$)/i.test(contentType)) {
      throw new Error(
        `${url} returned ${contentType || "missing Content-Type"}, expected text/plain`,
      );
    }
    return normalize(await response.text());
  };
  const primary = await get(`${CANONICAL}/llms.txt`);
  console.log(`Live /llms.txt: SHA256 ${digest(primary)}`);
  if (primary !== expected) {
    // A unique query is diagnostic, not a guarantee of CDN bypass.
    const probe = await get(`${CANONICAL}/llms.txt?discovery_check=${Date.now()}`);
    const likelyCause =
      probe === expected
        ? "The canonical URL appears cached/stale; inspect its Cloudflare cache key and purge only /llms.txt after deployment."
        : "Both paths differ from the repository; inspect deployed commit/origin and deployment status before purging caches.";
    throw new Error(
      `Published llms.txt differs from the repository. Cache-busting probe SHA256 ${digest(probe)}. ${likelyCause}`,
    );
  }
  console.log("OK: published llms.txt matches the repository and has the right MIME type.");
}
