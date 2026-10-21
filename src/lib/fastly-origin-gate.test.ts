import { describe, expect, it } from "vitest";
import {
  FASTLY_ORIGIN_HOSTNAME,
  FASTLY_ORIGIN_SECRET_HEADER,
  fastlyOriginGate,
} from "./fastly-origin-gate";

const key = "a".repeat(64);
function request(host: string, secret?: string): Request {
  return new Request(`https://${host}/api/health`, {
    headers: secret ? { [FASTLY_ORIGIN_SECRET_HEADER]: secret } : undefined,
  });
}

describe("Fastly dedicated-origin authentication", () => {
  it("does not change the existing public production hostname", () => {
    expect(fastlyOriginGate(request("jogomanager.com"), undefined)).toBeNull();
    expect(fastlyOriginGate(request("www.jogomanager.com"), undefined)).toBeNull();
  });

  it("fails closed if the edge secret has not been provisioned", () => {
    const response = fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME), {});
    expect(response?.status).toBe(503);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects requests without a matching Fastly-generated secret", () => {
    expect(fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME), { FASTLY_ORIGIN_SECRET: key })?.status).toBe(403);
    expect(fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, "b".repeat(64)), { FASTLY_ORIGIN_SECRET: key })?.status).toBe(403);
    expect(fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, key.toUpperCase()), { FASTLY_ORIGIN_SECRET: key })?.status).toBe(403);
  });

  it("allows an authenticated dedicated-origin request", () => {
    expect(fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, key), { FASTLY_ORIGIN_SECRET: key })).toBeNull();
  });

  it("rejects malformed secrets even if supplied by a client", () => {
    expect(fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, "short"), { FASTLY_ORIGIN_SECRET: "short" })?.status).toBe(503);
  });
});
