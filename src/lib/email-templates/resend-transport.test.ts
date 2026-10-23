import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverViaResend } from "./resend-transport";

const fixture = {
  key: "test-secret-never-sent",
  from: "Pro Football Manager 3D <boasvindas@jogomanager.com>",
  recipient: "recipient@example.test",
  subject: "Account notification",
  html: "<p>Notice</p>",
  text: "Notice",
  idempotencyKey: "stable-transaction-1",
};
afterEach(() => vi.unstubAllGlobals());

describe("resilient Resend transport", () => {
  it("sends multipart HTML/plain text with fixed idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await deliverViaResend(fixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers["Idempotency-Key"]).toBe(fixture.idempotencyKey);
    expect(request.headers.Authorization).toContain("Bearer ");
    expect(JSON.parse(request.body)).toMatchObject({ to: [fixture.recipient], text: fixture.text });
  });

  it("retries a temporary upstream outage with the same key and payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await deliverViaResend(fixture);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![1].headers["Idempotency-Key"]).toBe(
      fetchMock.mock.calls[1]![1].headers["Idempotency-Key"],
    );
    expect(fetchMock.mock.calls[0]![1].body).toBe(fetchMock.mock.calls[1]![1].body);
  });

  it("does not retry invalid requests or rejected recipients", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deliverViaResend(fixture)).rejects.toThrow("HTTP 422");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
