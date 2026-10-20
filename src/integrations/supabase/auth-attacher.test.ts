import { beforeEach, describe, expect, it, vi } from "vitest";

type SessionResult = { data: { session: { access_token: string } | null } };
type NextOptions = { headers: Record<string, string> };
type ClientRun = (context: { next: (options: NextOptions) => Promise<string> }) => Promise<string>;

const observed = vi.hoisted(() => ({
  clientLoads: 0,
  getSession: vi.fn<() => Promise<SessionResult>>(),
  run: undefined as ClientRun | undefined,
}));

// Exercise the registered client handler without starting an SSR server.
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({
    client(run: ClientRun) {
      observed.run = run;
      return { options: { client: run } };
    },
  }),
}));

vi.mock("./client", () => {
  observed.clientLoads++;
  return { supabase: { auth: { getSession: observed.getSession } } };
});

beforeEach(() => {
  observed.getSession.mockReset();
});

async function invoke(next: (options: NextOptions) => Promise<string>) {
  await import("./auth-attacher");
  if (!observed.run) throw new Error("Client middleware was not registered");
  return observed.run({ next });
}

describe("server function session attachment", () => {
  it("keeps the Supabase client out of middleware startup until a request needs it", async () => {
    await import("./auth-attacher");
    expect(observed.clientLoads).toBe(0);
    observed.getSession.mockResolvedValue({ data: { session: null } });
    const next = vi.fn(async () => "anonymous result");
    await expect(invoke(next)).resolves.toBe("anonymous result");
    expect(observed.clientLoads).toBe(1);
    expect(next).toHaveBeenCalledWith({ headers: {} });
  });

  it("awaits the current session before issuing an authenticated request", async () => {
    let release: ((result: SessionResult) => void) | undefined;
    observed.getSession.mockImplementation(
      () => new Promise<SessionResult>((resolve) => (release = resolve)),
    );
    const next = vi.fn(async () => "private result");
    const response = invoke(next);
    await vi.waitFor(() => expect(observed.getSession).toHaveBeenCalledTimes(1));
    expect(next).not.toHaveBeenCalled();
    release?.({ data: { session: { access_token: "fixture-account-a" } } });
    await expect(response).resolves.toBe("private result");
    expect(next).toHaveBeenCalledWith({
      headers: { Authorization: "Bearer fixture-account-a" },
    });
  });

  it("reuses the module but reads a fresh token after an account change", async () => {
    observed.getSession
      .mockResolvedValueOnce({ data: { session: { access_token: "fixture-account-a" } } })
      .mockResolvedValueOnce({ data: { session: { access_token: "fixture-account-b" } } })
      .mockResolvedValueOnce({ data: { session: null } });
    const next = vi.fn(async () => "result");
    await invoke(next);
    await invoke(next);
    await invoke(next);
    expect(next.mock.calls).toEqual([
      [{ headers: { Authorization: "Bearer fixture-account-a" } }],
      [{ headers: { Authorization: "Bearer fixture-account-b" } }],
      [{ headers: {} }],
    ]);
    expect(observed.getSession).toHaveBeenCalledTimes(3);
    expect(observed.clientLoads).toBe(1);
  });

  it("does not send an anonymous fallback request when the session lookup rejects", async () => {
    observed.getSession.mockRejectedValue(new Error("session storage unavailable"));
    const next = vi.fn(async () => "must not send");
    await expect(invoke(next)).rejects.toThrow("session storage unavailable");
    expect(next).not.toHaveBeenCalled();
  });
});
