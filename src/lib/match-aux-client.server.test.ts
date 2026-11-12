import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { matchAuxEnabled, simulateOnMatchAux } from "./match-aux-client.server";

const MATCH_URL = "https://matches-vps.jogomanager.com";
const SECRET = "test-only-match-secret-at-least-32-bytes-2026";
const input = {
  roomId: "2f82ecf8-99bb-43bf-a2cc-1a9e5086fd51",
  homeClub: "fla",
  awayClub: "pal",
  seed: "test-only-2026-match-private-seed",
};

function setup(): void {
  vi.stubEnv("MATCH_AUX_ENABLED", "1");
  vi.stubEnv("MATCH_AUX_URL", MATCH_URL);
  vi.stubEnv("MATCH_AUX_SIGNING_KEY", SECRET);
}

function success(): Response {
  return Response.json({ hg: 2, ag: 1, minute: 95, steps: 28_000 });
}

describe("Cloudflare-to-VPS signed match transport", () => {
  beforeEach(() => {
    vi.stubEnv("MATCH_AUX_ENABLED", "0");
    vi.stubEnv("MATCH_AUX_URL", "");
    vi.stubEnv("MATCH_AUX_SIGNING_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("cannot be enabled accidentally without the explicit rollout flag and secret", () => {
    expect(matchAuxEnabled()).toBe(false);
    vi.stubEnv("MATCH_AUX_ENABLED", "1");
    vi.stubEnv("MATCH_AUX_URL", MATCH_URL);
    expect(matchAuxEnabled()).toBe(false);
    vi.stubEnv("MATCH_AUX_SIGNING_KEY", SECRET);
    expect(matchAuxEnabled()).toBe(true);
    vi.stubEnv("MATCH_AUX_ENABLED", "0");
    expect(matchAuxEnabled()).toBe(false);
  });

  it("denies host, scheme, credentials, port, fragment and pathname abuse", () => {
    setup();
    for (const url of [
      "http://matches-vps.jogomanager.com",
      "https://matches-vps.jogomanager.com.evil.example",
      "https://example.com",
      "https://user:pass@matches-vps.jogomanager.com",
      "https://matches-vps.jogomanager.com:8443",
      "https://matches-vps.jogomanager.com/a",
      "https://matches-vps.jogomanager.com/#secret",
      "https://matches-vps.jogomanager.com/?dest=https://evil.example",
    ]) {
      vi.stubEnv("MATCH_AUX_URL", url);
      expect(matchAuxEnabled(), url).toBe(false);
    }
  });

  it("signs the exact request body and verifies the response shape", async () => {
    setup();
    const fetchMock = vi.fn(async (url: URL | RequestInfo, options?: RequestInit) => {
      expect(String(url)).toBe(MATCH_URL + "/v1/simulate");
      expect(options?.method).toBe("POST");
      expect(options?.redirect).toBe("error");
      expect(options?.cache).toBe("no-store");
      expect(options?.body).toBe(JSON.stringify(input));
      const headers = new Headers(options?.headers);
      const timestamp = headers.get("x-pfm-timestamp")!;
      const signature = headers.get("x-pfm-signature");
      expect(signature).toBe(
        createHmac("sha256", SECRET).update(`${timestamp}.${options?.body}`).digest("hex"),
      );
      expect(headers.get("authorization")).toBeNull();
      return success();
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(simulateOnMatchAux(input)).resolves.toEqual({
      hg: 2,
      ag: 1,
      minute: 95,
      steps: 28_000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries bounded server_busy responses and then succeeds", async () => {
    setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "server_busy" }, { status: 429 }))
      .mockResolvedValueOnce(success());
    vi.stubGlobal("fetch", fetchMock);
    await expect(simulateOnMatchAux(input)).resolves.toMatchObject({ hg: 2, ag: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when response schema is invalid or upstream is unavailable", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ hg: 200, ag: 0 })));
    await expect(simulateOnMatchAux(input)).rejects.toThrow("match_aux_invalid_result");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(Response.json({ error: "unauthorized" }, { status: 401 })),
    );
    await expect(simulateOnMatchAux(input)).rejects.toThrow("match_aux_not_available");
  });

  it("never sends a match when the canary URL has not passed allowlisting", async () => {
    setup();
    vi.stubEnv("MATCH_AUX_URL", "https://other.jogomanager.com");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(simulateOnMatchAux(input)).rejects.toThrow("match_aux_not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
