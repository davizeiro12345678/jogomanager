import { pathToFileURL } from "node:url";

const PUBLIC_CHECKS = [
  { url: "https://jogomanager.com/api/health", type: "json" },
  { url: "https://jogomanager.com/", type: "html" },
  { url: "https://www.jogomanager.com/", type: "html", followCanonical: true },
];

export async function verifyPublicDeployment({
  expectedSha,
  fetchImpl = fetch,
  report = console.log,
} = {}) {
  if (typeof expectedSha !== "string" || !/^[a-f0-9]{40}$/.test(expectedSha)) {
    throw new Error("The expected commit must be a full 40-character lowercase Git SHA.");
  }
  for (const { url, type, followCanonical } of PUBLIC_CHECKS) {
    const response = await fetchImpl(url, {
      redirect: followCanonical ? "follow" : "manual",
      headers: { "cache-control": "no-cache" },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 200) {
      throw new Error(`${url}: expected HTTP 200 for anonymous visitors; got ${response.status}`);
    }
    const destination = new URL(response.url || url);
    if (
      destination.hostname === "cloudflareaccess.com" ||
      destination.hostname.endsWith(".cloudflareaccess.com") ||
      destination.pathname.startsWith("/cdn-cgi/access/")
    ) {
      throw new Error(`${url}: redirected to Cloudflare Access login`);
    }
    if (
      destination.origin !== "https://jogomanager.com" &&
      destination.origin !== "https://www.jogomanager.com"
    ) {
      throw new Error(`${url}: unexpected public origin: ${destination.origin}`);
    }
    const body = await response.text();
    if (/Cloudflare Access|\/cdn-cgi\/access\/login|Log in to .*Cloudflare Workers/i.test(body)) {
      throw new Error(`${url}: Cloudflare Access login page served instead of the public app`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (type === "json") {
      if (!contentType.includes("application/json")) {
        throw new Error(`${url}: expected JSON health, received ${contentType}`);
      }
      const health = JSON.parse(body);
      if (health.status !== "ready") {
        throw new Error(`${url}: backend health is not ready: ${health.status}`);
      }
      const deployedSha = health.release?.commit;
      if (typeof deployedSha !== "string" || !/^[a-f0-9]{40}$/.test(deployedSha)) {
        throw new Error(`${url}: missing or invalid deployed commit identity`);
      }
      if (deployedSha !== expectedSha) {
        throw new Error(
          `${url}: deployed commit does not match ${expectedSha}; got ${deployedSha}`,
        );
      }
    } else if (!contentType.includes("text/html") || !/Pro Football Manager 3D/i.test(body)) {
      throw new Error(`${url}: expected public game HTML, got unexpected content`);
    }
    report(`PASS anonymous public access: ${url}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await verifyPublicDeployment({ expectedSha: process.env["EXPECTED_COMMIT_SHA"] });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Public deployment verification failed");
    process.exitCode = 1;
  }
}
