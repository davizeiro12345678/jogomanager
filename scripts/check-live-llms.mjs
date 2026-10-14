#!/usr/bin/env node
/**
 * Post-deployment smoke test, intentionally not a pre-deploy CI gate.
 * The deployed /llms.txt must have identical content to public/llms.txt.
 * CDN staleness or a deploy pointed at another commit should fail loudly.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const canonical = "https://jogomanager.com";
const target = `${canonical}/llms.txt`;
const normalize = (value) => value.replace(/\r\n/g, "\n").trimEnd();
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);

async function verify() {
  const expected = normalize(
    await readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
  );
  const response = await fetch(target, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "text/plain", "Cache-Control": "no-cache" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  const actual = normalize(await response.text());
  const type = response.headers.get("content-type") ?? "";
  const isText = /^text\/plain\b/i.test(type);
  const isCanonical = response.url === target;
  const same = actual === expected;
  console.log(
    JSON.stringify(
      {
        url: response.url,
        status: response.status,
        contentType: type,
        deployedSha256Prefix: hash(actual),
        repositorySha256Prefix: hash(expected),
        matchesRepository: same,
        canonicalUrl: isCanonical,
      },
      null,
      2,
    ),
  );
  if (!response.ok || !isCanonical || !isText || !same) {
    throw new Error(
      "Production llms.txt differs from the repository or has invalid HTTP metadata. " +
        "Verify the deployed commit and Cloudflare cache; redeploy before a targeted cache purge.",
    );
  }
}
verify().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
