import { describe, expect, it } from "vitest";
import { requireVerifiedMfaSession } from "./mfa-session.server";

describe("server-side MFA", () => {
  const client = (
    user: { id: string; factors?: { status: string }[] } | null,
    error: unknown = null,
  ) => ({ auth: { getUser: async () => ({ data: { user }, error }) } });
  it("blocks a recovered/password session while a verified factor exists", async () => {
    await expect(
      requireVerifiedMfaSession(
        client({ id: "owner", factors: [{ status: "verified" }] }),
        "token",
        { sub: "owner", aal: "aal1" },
      ),
    ).rejects.toThrow("MFA");
  });
  it("fails closed when Auth is unreachable or the token owner differs", async () => {
    await expect(
      requireVerifiedMfaSession(client(null, new Error("offline")), "token", { sub: "owner" }),
    ).rejects.toThrow();
    await expect(
      requireVerifiedMfaSession(client({ id: "other" }), "token", { sub: "owner" }),
    ).rejects.toThrow();
  });
  it("keeps accounts without factors and verified AAL2 sessions working", async () => {
    await expect(
      requireVerifiedMfaSession(client({ id: "owner" }), "token", { sub: "owner", aal: "aal1" }),
    ).resolves.toBeUndefined();
    await expect(
      requireVerifiedMfaSession(client(null), "token", { sub: "owner", aal: "aal2" }),
    ).resolves.toBeUndefined();
  });
});
