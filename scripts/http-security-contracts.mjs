import assert from "node:assert/strict";

const base = new URL(process.argv[2] ?? "https://jogomanager.com/");
assert.equal(base.protocol, "https:", "Passive checks require an HTTPS origin");

const paths = [
  { path: "/", privateRoute: false, html: true },
  { path: "/api/health", privateRoute: true, html: false },
  { path: "/new", privateRoute: true, html: true },
  { path: "/dashboard", privateRoute: true, html: true },
];

let failures = 0;
for (const entry of paths) {
  const url = new URL(entry.path, base);
  if (url.origin !== base.origin) throw new Error("Cross-origin target blocked");
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    const cache = (response.headers.get("cache-control") ?? "").toLowerCase();
    const csp = response.headers.get("content-security-policy") ?? "";
    const issues = [];
    if (!response.ok) issues.push("unexpected_status");
    if (response.headers.get("x-content-type-options")?.toLowerCase() !== "nosniff")
      issues.push("missing_nosniff");
    if (!response.headers.get("strict-transport-security")) issues.push("missing_hsts");
    if (entry.privateRoute && !cache.includes("no-store")) issues.push("private_cacheable");
    if (entry.html && !csp) issues.push("missing_csp");
    const warnings = [];
    if (csp.includes("'unsafe-eval'")) warnings.push("csp_unsafe_eval");
    if (csp.includes("'unsafe-inline'")) warnings.push("csp_unsafe_inline");
    console.log(
      JSON.stringify({
        path: entry.path,
        status: response.status,
        cacheControl: cache,
        issues,
        warnings,
      }),
    );
    if (issues.length) failures++;
  } catch (error) {
    failures++;
    console.error(JSON.stringify({ path: entry.path, error: String(error) }));
  }
}
if (failures) {
  console.error("Passive header contracts failed on " + failures + " route(s).");
  process.exitCode = 1;
}
