import { describe, expect, it, vi } from "vitest";
import {
  directOAuthProviders,
  isOAuthBrokerUnavailable,
  signInWithOAuthRecovery,
} from "./oauth-recovery";

function options() {
  return {
    provider: "google" as const,
    useBroker: true,
    directProviders: ["google"],
    broker: vi.fn(async (): Promise<{ error?: unknown; redirected?: boolean }> => ({
      redirected: true,
    })),
    direct: vi.fn(async () => ({})),
  };
}

describe("OAuth broker recovery in the same Supabase project", () => {
  it("recovers exhausted broker credits only for an explicitly configured direct provider", async () => {
    const input = options();
    input.broker.mockResolvedValue({ error: { status: 402 } });
    expect(await signInWithOAuthRecovery(input)).toEqual({
      path: "direct",
      redirected: true,
      recovered: true,
    });
    expect(input.direct).toHaveBeenCalledTimes(1);
  });

  it("does not infer direct credentials from broker-managed provider flags", async () => {
    const input = { ...options(), directProviders: [] };
    const error = { code: "insufficient_credits" };
    input.broker.mockResolvedValue({ error });
    await expect(signInWithOAuthRecovery(input)).rejects.toBe(error);
    expect(input.direct).not.toHaveBeenCalled();
  });

  it.each([
    { code: "access_denied", status: 403 },
    { code: "invalid_credentials", status: 400 },
    { code: "over_request_rate_limit", status: 429 },
    { name: "AbortError" },
    { code: "mfa_required" },
    new TypeError("Cannot read properties of undefined"),
  ])("preserves account, cancellation and abuse-control errors: %j", async (error) => {
    const input = options();
    input.broker.mockResolvedValue({ error });
    await expect(signInWithOAuthRecovery(input)).rejects.toBe(error);
    expect(input.direct).not.toHaveBeenCalled();
  });

  it("recovers a network failure, preserving a direct-provider error", async () => {
    const input = options();
    input.broker.mockRejectedValue(new TypeError("network unavailable"));
    const error = { code: "provider_disabled" };
    input.direct.mockResolvedValue({ error } as never);
    await expect(signInWithOAuthRecovery(input)).rejects.toBe(error);
    expect(input.direct).toHaveBeenCalledTimes(1);
  });

  it("does not start a second OAuth flow after a broker redirect", async () => {
    const input = options();
    expect((await signInWithOAuthRecovery(input)).path).toBe("broker");
    expect(input.direct).not.toHaveBeenCalled();
  });

  it("keeps a nonredirected broker session and skips the broker in direct mode", async () => {
    const input = options();
    input.broker.mockResolvedValue({});
    expect((await signInWithOAuthRecovery(input)).redirected).toBe(false);
    input.useBroker = false;
    expect((await signInWithOAuthRecovery(input)).path).toBe("direct");
    expect(input.broker).toHaveBeenCalledTimes(1);
  });

  it("parses only an explicit public provider allowlist", () => {
    expect(directOAuthProviders(undefined)).toEqual([]);
    expect(directOAuthProviders(" google, azure,google, ")).toEqual(["google", "azure"]);
    expect(isOAuthBrokerUnavailable({ status: 500 })).toBe(true);
    expect(isOAuthBrokerUnavailable("unknown")).toBe(false);
  });
});
