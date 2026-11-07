import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ factory: vi.fn(), handler: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@lovable.dev/email-js", () => ({ createAuthEmailHandler: mocks.factory }));

import { Route } from "./webhook";

const post = (
  Route as unknown as {
    options: { server: { handlers: { POST(args: { request: Request }): Promise<Response> } } };
  }
).options.server.handlers.POST;

function request() {
  return new Request("https://jogomanager.com/lovable/email/auth/webhook", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOVABLE_API_KEY", "fixture-auth-email-key");
  mocks.handler.mockResolvedValue(new Response("ok"));
  mocks.factory.mockReturnValue(mocks.handler);
});
afterEach(() => vi.unstubAllEnvs());

describe("Auth email send URL policy", () => {
  it.each([
    "http://example.test/send",
    "https://user:password@example.test/send",
    "https://example.test/send#fragment",
  ])("rejects unsafe configuration before constructing the SDK: %s", (url) => {
    vi.stubEnv("LOVABLE_SEND_URL", url);
    expect(() => post({ request: request() })).toThrow(/HTTPS/);
    expect(mocks.factory).not.toHaveBeenCalled();
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("preserves SDK verification and the HTTPS endpoint for valid configuration", async () => {
    vi.stubEnv("LOVABLE_SEND_URL", "https://api.example.test/send");
    const incoming = request();
    expect((await post({ request: incoming })).status).toBe(200);
    expect(mocks.factory).toHaveBeenCalledWith(
      expect.objectContaining({ sendUrl: "https://api.example.test/send" }),
    );
    expect(mocks.handler).toHaveBeenCalledWith(incoming);
  });
});
