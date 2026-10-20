import { beforeEach, describe, expect, it, vi } from "vitest";

type SessionResult = { data: { session: { user: { id: string } } | null } };
type AuthorizationDetails = {
  client?: { name?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
};
type RouteOptions = {
  ssr: boolean;
  beforeLoad: (input: {
    search: { authorization_id: string };
    location: { pathname: string; searchStr: string };
  }) => Promise<void>;
  loader: (input: { location: { search: string } }) => Promise<AuthorizationDetails | null>;
};

const observed = vi.hoisted(() => ({
  clientLoads: 0,
  route: undefined as RouteOptions | undefined,
  getSession: vi.fn<() => Promise<SessionResult>>(),
  getAuthorizationDetails:
    vi.fn<(id: string) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>>(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: RouteOptions) => {
    observed.route = options;
    return { options };
  },
  redirect: (options: Record<string, unknown>) => ({ redirect: options }),
  Link: () => null,
}));

vi.mock("./client", () => {
  observed.clientLoads++;
  return {
    supabase: {
      auth: {
        getSession: observed.getSession,
        oauth: { getAuthorizationDetails: observed.getAuthorizationDetails },
      },
    },
  };
});

const input = {
  search: { authorization_id: "fixture-authorization" },
  location: {
    pathname: "/.lovable/oauth/consent",
    searchStr: "?authorization_id=fixture-authorization",
  },
};

async function route() {
  await import("../../routes/[.]lovable.oauth.consent");
  if (!observed.route) throw new Error("Consent route was not registered");
  return observed.route;
}

beforeEach(() => {
  observed.getSession.mockReset();
  observed.getAuthorizationDetails.mockReset();
});

describe("OAuth consent lazy session loading", () => {
  it("does not load the SDK merely by registering route metadata", async () => {
    const config = await route();
    expect(config.ssr).toBe(false);
    expect(observed.clientLoads).toBe(0);
  });

  it("rejects a missing authorization ID before asking for a session", async () => {
    await expect(
      (await route()).beforeLoad({ ...input, search: { authorization_id: "" } }),
    ).rejects.toThrow("Missing authorization_id");
    expect(observed.getSession).not.toHaveBeenCalled();
  });

  it("keeps the anonymous redirect and its exact return destination", async () => {
    observed.getSession.mockResolvedValue({ data: { session: null } });
    await expect((await route()).beforeLoad(input)).rejects.toEqual({
      redirect: {
        to: "/auth",
        search: { next: input.location.pathname + input.location.searchStr },
      },
    });
    expect(observed.clientLoads).toBe(1);
  });

  it("waits for the authenticated session before allowing the consent route", async () => {
    let release: ((value: SessionResult) => void) | undefined;
    observed.getSession.mockImplementation(
      () => new Promise<SessionResult>((resolve) => (release = resolve)),
    );
    let allowed = false;
    const pending = (await route()).beforeLoad(input).then(() => (allowed = true));
    await vi.waitFor(() => expect(observed.getSession).toHaveBeenCalledTimes(1));
    expect(allowed).toBe(false);
    release?.({ data: { session: { user: { id: "fixture-account" } } } });
    await pending;
    expect(allowed).toBe(true);
  });

  it("propagates session lookup failure without authorizing access", async () => {
    observed.getSession.mockRejectedValue(new Error("session lookup failed"));
    await expect((await route()).beforeLoad(input)).rejects.toThrow("session lookup failed");
    expect(observed.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it("loads details for the requested authorization and returns the same client disclosure", async () => {
    const details = { client: { name: "Fixture application" } };
    observed.getAuthorizationDetails.mockResolvedValue({ data: details, error: null });
    await expect(
      (await route()).loader({ location: { search: input.location.searchStr } }),
    ).resolves.toEqual(details);
    expect(observed.getAuthorizationDetails).toHaveBeenCalledWith("fixture-authorization");
  });

  it("preserves the server-approved immediate redirect and rejects authorization errors", async () => {
    observed.getAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: "https://fixture.example/oauth/return" },
      error: null,
    });
    const config = await route();
    await expect(config.loader({ location: { search: input.location.searchStr } })).rejects.toEqual(
      {
        redirect: { href: "https://fixture.example/oauth/return" },
      },
    );
    observed.getAuthorizationDetails.mockResolvedValueOnce({
      data: null,
      error: new Error("authorization denied"),
    });
    await expect(config.loader({ location: { search: input.location.searchStr } })).rejects.toThrow(
      "authorization denied",
    );
  });
});
