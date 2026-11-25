import { describe, expect, it } from "vitest";
import { rejectSuspiciousEdgeRequest } from "./edge-request-guard";

const request = (path: string, method = "GET") =>
  new Request("https://jogomanager.com" + path, { method });

describe("Worker edge request guard", () => {
  it.each([
    "/",
    "/auth",
    "/auth/callback?code=abc&state=def",
    "/mcp",
    "/.well-known/oauth-protected-resource",
    "/api/stripe/webhook",
    "/api/auth/signin",
    "/_serverFn/assets/app.js",
    "/assets/match.wasm",
    "/tabelas",
  ])("preserves legitimate path %s", (path) => {
    expect(rejectSuspiciousEdgeRequest(request(path))).toBeNull();
  });

  it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "preserves legitimate HTTP method %s",
    (method) => expect(rejectSuspiciousEdgeRequest(request("/api/health", method))).toBeNull(),
  );

  it.each([
    "/.env",
    "/.env.production",
    "/core/.env.copy",
    "/%2eenv",
    "/%252eenv",
    "/.git/config",
    "/%2egit/config",
    "/.ssh/id_rsa",
    "/.aws/credentials",
    "/.terraform/terraform.tfstate",
    "/var/backup.sql",
    "/node_modules/react/index.js",
    "/actuator/env",
    "/actuator/heapdump",
    "/server-status",
    "/wp-login.php",
    "/wp-content/plugins/legacy/plugin.php",
    "/phpmyadmin/index.php",
    "/cgi-bin/luci",
    "/vendor/phpunit/phpunit/src/util/php/eval-stdin.php",
    "/debug/pprof/cmdline",
    "/v2/_catalog",
  ])("blocks suspicious path %s", (path) => {
    const result = rejectSuspiciousEdgeRequest(request(path));
    expect(result?.status).toBe(403);
    expect(result?.headers.get("cache-control")).toContain("no-store");
  });

  it.each(["TRACE", "PROPFIND", "CONNECT", "COPY", "MKCOL", "SEARCH"])(
    "blocks unused method %s",
    (method) => {
      // The Fetch constructor refuses TRACE/CONNECT, although hostile HTTP clients can send them.
      const inbound = { url: "https://jogomanager.com/", method } as Request;
      expect(rejectSuspiciousEdgeRequest(inbound)?.status).toBe(403);
    },
  );

  it("returns an empty body for blocked HEAD requests", async () => {
    const result = rejectSuspiciousEdgeRequest(request("/.env", "HEAD"));
    expect(result?.status).toBe(403);
    expect(await result?.text()).toBe("");
  });
});
