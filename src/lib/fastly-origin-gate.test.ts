import { describe, expect, it } from "vitest";
import {
  FASTLY_ORIGIN_HOSTNAME,
  FASTLY_ORIGIN_SECRET_HEADER,
  fastlyOriginGate,
} from "./fastly-origin-gate";

const key = "a".repeat(64);
function request(host: string, secret?: string): Request {
  return new Request(`https://${host}/api/health`, {
    ...(secret ? { headers: { [FASTLY_ORIGIN_SECRET_HEADER]: secret } } : {}),
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
    const env = { FASTLY_ORIGIN_SECRET: key };
    const missing = fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME), env);
    const wrong = fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, "b".repeat(64)), env);
    const uppercase = fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, key.toUpperCase()), env);
    expect(missing?.status).toBe(403);
    expect(wrong?.status).toBe(403);
    expect(uppercase?.status).toBe(403);
  });

  it("allows an authenticated dedicated-origin request", () => {
    const response = fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, key), {
      FASTLY_ORIGIN_SECRET: key,
    });
    expect(response).toBeNull();
  });

  it("rejects malformed secrets even if supplied by a client", () => {
    const response = fastlyOriginGate(request(FASTLY_ORIGIN_HOSTNAME, "short"), {
      FASTLY_ORIGIN_SECRET: "short",
    });
    expect(response?.status).toBe(503);
  });
});
