import { afterEach, describe, expect, it, vi } from "vitest";

import { matchAuxEnabled, simulateOnMatchAux } from "./match-aux-client.server";

const ROOM_ID = "123e4567-e89b-42d3-a456-426614174000";
const ORIGIN = "https://matches-vps.jogomanager.com";

function configureCanary() {
  vi.stubEnv("MATCH_AUX_ENABLED", "1");
  vi.stubEnv("MATCH_AUX_ROLLOUT_PERCENT", "100");
  vi.stubEnv("MATCH_AUX_URL", ORIGIN);
  vi.stubEnv("MATCH_AUX_SIGNING_KEY", "test-secret-at-least-thirty-two-characters-long");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("server-side VPS match authority canary", () => {
  it("fails closed without an explicit enable flag and rollout", () => {
    configureCanary();
    vi.stubEnv("MATCH_AUX_ENABLED", "0");
    expect(matchAuxEnabled(ROOM_ID)).toBe(false);
    vi.stubEnv("MATCH_AUX_ENABLED", "1");
    vi.stubEnv("MATCH_AUX_ROLLOUT_PERCENT", "0");
    expect(matchAuxEnabled(ROOM_ID)).toBe(false);
    expect(matchAuxEnabled()).toBe(false);
  });

  it("requires a strong server-only signing key and a valid percentage", () => {
    configureCanary();
    vi.stubEnv("MATCH_AUX_SIGNING_KEY", "short");
    expect(matchAuxEnabled(ROOM_ID)).toBe(false);
    vi.stubEnv("MATCH_AUX_SIGNING_KEY", "test-secret-at-least-thirty-two-characters-long");
    for (const rollout of ["-1", "1.5", "101", "invalid"]) {
      vi.stubEnv("MATCH_AUX_ROLLOUT_PERCENT", rollout);
      expect(matchAuxEnabled(ROOM_ID)).toBe(false);
    }
  });

  it("permits only the fixed Cloudflare HTTPS origin", () => {
    configureCanary();
    expect(matchAuxEnabled(ROOM_ID)).toBe(true);
    for (const origin of [
      "http://matches-vps.jogomanager.com",
      "https://malicious.example",
      "https://matches-vps.jogomanager.com:8443",
      "https://matches-vps.jogomanager.com/private",
      "https://matches-vps.jogomanager.com/?token=1",
      "https://user:password@matches-vps.jogomanager.com",
    ]) {
      vi.stubEnv("MATCH_AUX_URL", origin);
      expect(matchAuxEnabled(ROOM_ID)).toBe(false);
    }
  });

  it("assigns rooms deterministically within a partial rollout", () => {
    configureCanary();
    vi.stubEnv("MATCH_AUX_ROLLOUT_PERCENT", "5");
    const first = matchAuxEnabled(ROOM_ID);
    expect(matchAuxEnabled(ROOM_ID)).toBe(first);
  });

  it("signs the remote request without forwarding browser credentials", async () => {
    configureCanary();
    const fetchMock = vi.fn(
      async (_url: URL, _options: RequestInit) =>
        new Response(JSON.stringify({ hg: 2, ag: 1, minute: 90, steps: 30000 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await simulateOnMatchAux({
      roomId: ROOM_ID,
      homeClub: "club_a",
      awayClub: "club_b",
      seed: "authoritative-test-seed-20261112",
    });
    expect(result).toEqual({ hg: 2, ag: 1, minute: 90, steps: 30000 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toBe(ORIGIN + "/v1/simulate");
    expect(options.credentials).toBe("omit");
    expect(options.redirect).toBe("error");
    const headers = options.headers as Record<string, string>;
    expect(headers["x-pfm-signature"]).toMatch(/^[a-f0-9]{64}$/);
    expect(headers["x-pfm-timestamp"]).toMatch(/^\d+$/);
  });
});
