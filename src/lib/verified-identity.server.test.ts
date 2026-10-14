import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const { getRequestMock } = vi.hoisted(() => ({ getRequestMock: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: getRequestMock,
}));

import { verifiedAccount } from "./verified-identity.server";

type AuthResult = {
  data: { user: { id: string; email: string; email_confirmed_at: string | null } | null };
  error: null;
};
const getUser = vi.fn<(token: string) => Promise<AuthResult>>();
const client = { auth: { getUser } } as unknown as SupabaseClient<Database>;
const uid = "9ab8df4e-456f-4afa-b8ec-f62a902e0210";

beforeEach(() => {
  vi.resetAllMocks();
  getRequestMock.mockReturnValue({
    headers: {
      get: (header: string) =>
        header === "authorization" ? "Bearer valid.jwt.signature" : null,
    },
  });
});

describe("verified account boundary", () => {
  it("rejects missing tokens before contacting Auth", async () => {
    getRequestMock.mockReturnValue({ headers: { get: () => null } });
    await expect(verifiedAccount(client, uid)).resolves.toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("does not trust a session for an unconfirmed email address", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: uid, email: "someone@example.com", email_confirmed_at: null } },
      error: null,
    });
    await expect(verifiedAccount(client, uid)).resolves.toBeNull();
  });

  it("rejects a valid token belonging to another user", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "other-user",
          email: "someone@example.com",
          email_confirmed_at: "2026-10-14T00:00:00Z",
        },
      },
      error: null,
    });
    await expect(verifiedAccount(client, uid)).resolves.toBeNull();
  });

  it("accepts only a confirmed email belonging to the authenticated subject", async () => {
    const account = {
      id: uid,
      email: "owner@example.com",
      email_confirmed_at: "2026-10-14T00:00:00Z",
    };
    getUser.mockResolvedValue({ data: { user: account }, error: null });
    await expect(verifiedAccount(client, uid)).resolves.toEqual(account);
    expect(getUser).toHaveBeenCalledWith("valid.jwt.signature");
  });
});
