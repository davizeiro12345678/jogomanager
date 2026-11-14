import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allocateQueuePair,
  loadPrivateLiveRoom,
  validateAuthorityDatabaseTarget,
  type AuthorityDatabaseEnv,
} from "./supabase";

const serviceKey = "testing-local-only-no-real-privileges-123456789";
const stagingRef = "abcdefghijklmnopqrst";
const stagingUrl = `https://${stagingRef}.supabase.co`;
const makeEnv = (
  url: string,
  role: AuthorityDatabaseEnv["MATCH_AUTHORITY_ENV"],
): AuthorityDatabaseEnv => ({
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  MATCH_AUTHORITY_ENV: role,
  ...(role === "staging" ? { STAGING_SUPABASE_PROJECT_REF: stagingRef } : {}),
});

afterEach(() => vi.restoreAllMocks());

describe("match authority database isolation", () => {
  it("rejects the production project from staging even with a valid service key", () => {
    expect(() =>
      validateAuthorityDatabaseTarget(
        makeEnv("https://lguqnwvsfeefxamzeyos.supabase.co", "staging"),
      ),
    ).toThrow(/environment/);
  });

  it("allows only the production project for the production Worker", () => {
    expect(() =>
      validateAuthorityDatabaseTarget(
        makeEnv("https://lguqnwvsfeefxamzeyos.supabase.co", "production"),
      ),
    ).not.toThrow();
    expect(() => validateAuthorityDatabaseTarget(makeEnv(stagingUrl, "production"))).toThrow(
      /environment/,
    );
  });

  it("allows a different staging project and rejects untrusted hosts", () => {
    const staging = makeEnv(stagingUrl, "staging");
    expect(validateAuthorityDatabaseTarget(staging).hostname).toBe(`${stagingRef}.supabase.co`);
    for (const url of [
      `http://${stagingRef}.supabase.co`,
      `https://${stagingRef}.supabase.co.evil.test`,
      "https://evil@example.supabase.co",
      `${stagingUrl}/admin`,
      `${stagingUrl}?token=secret`,
      "https://not-supabase.co",
    ]) {
      expect(() => validateAuthorityDatabaseTarget(makeEnv(url, "staging"))).toThrow();
    }
  });

  it("fails closed when staging ref is absent, mismatched or points to production", () => {
    const valid = makeEnv(stagingUrl, "staging");
    expect(() => validateAuthorityDatabaseTarget(valid)).not.toThrow();
    for (const mismatch of [
      { ...valid, STAGING_SUPABASE_PROJECT_REF: undefined },
      { ...valid, STAGING_SUPABASE_PROJECT_REF: "qrstabcdefghijklmnop" },
      { ...valid, STAGING_SUPABASE_PROJECT_REF: "lguqnwvsfeefxamzeyos" },
      { ...valid, SUPABASE_URL: "https://lguqnwvsfeefxamzeyos.supabase.co" },
    ]) {
      expect(() => validateAuthorityDatabaseTarget(mismatch)).toThrow(/environment/);
    }
  });

  it("uses only apikey for opaque secret keys, not a fake bearer JWT", async () => {
    const client = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "empty" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const env = makeEnv(stagingUrl, "staging");
    env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_isolated-fixture-not-a-real-key-2026";
    await allocateQueuePair(env);
    expect(client).toHaveBeenCalledTimes(1);
    const [url, options] = client.mock.calls[0]!;
    expect(String(url)).toBe(`${stagingUrl}/rest/v1/rpc/match_queue_allocate`);
    const headers = new Headers(options?.headers);
    expect(headers.get("apikey")).toBe(env.SUPABASE_SERVICE_ROLE_KEY);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("preserves legacy service role bearer compatibility for isolated clients", async () => {
    const client = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ status: "empty" })));
    const env = makeEnv(stagingUrl, "staging");
    await allocateQueuePair(env);
    const headers = new Headers(client.mock.calls[0]![1]?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${serviceKey}`);
  });

  it("accepts a numeric UUID for staging room lookup and rejects malformed IDs before the network", async () => {
    const client = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { headers: { "content-type": "application/json" } }));
    const staging = makeEnv(stagingUrl, "staging");
    const validRoom = "12345678-1234-4123-8123-123456789012";

    expect(await loadPrivateLiveRoom(staging, validRoom)).toBeNull();
    expect(client).toHaveBeenCalledTimes(1);
    expect(String(client.mock.calls[0]![0])).toContain("id=eq.");
    expect(String(client.mock.calls[0]![0])).toContain(validRoom);

    expect(await loadPrivateLiveRoom(staging, "bad-room")).toBeNull();
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit deployment identity to avoid accidental DB mixing", () => {
    const broken = {
      ...makeEnv(stagingUrl, "staging"),
      MATCH_AUTHORITY_ENV: "unknown",
    } as unknown as AuthorityDatabaseEnv;
    expect(() => validateAuthorityDatabaseTarget(broken)).toThrow(/environment/);
  });
});
