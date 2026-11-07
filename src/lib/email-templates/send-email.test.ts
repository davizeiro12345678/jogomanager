import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendLovableEmail: vi.fn() }));

vi.mock("@lovable.dev/email-js", () => ({
  EmailAPIError: class EmailAPIError extends Error {},
  sendLovableEmail: mocks.sendLovableEmail,
}));

import { sendTemplateEmail, validateLovableSendUrl } from "./send-email";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("server email URL configuration", () => {
  it("accepts only HTTPS Lovable send URLs without credentials or fragments", () => {
    expect(validateLovableSendUrl("https://api.lovable.dev/v1/messaging/email/send")).toBe(
      "https://api.lovable.dev/v1/messaging/email/send",
    );
    expect(() => validateLovableSendUrl("http://api.lovable.dev/send")).toThrow(/HTTPS/);
    expect(() => validateLovableSendUrl("https://user:pass@api.lovable.dev/send")).toThrow(
      /credentials/i,
    );
    expect(() => validateLovableSendUrl("https://api.lovable.dev/send#fragment")).toThrow(
      /fragments/i,
    );
  });

  it("rejects an insecure configured send URL before invoking the SDK", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-lovable-key");
    vi.stubEnv("LOVABLE_SEND_URL", "http://localhost:8787/send");

    await expect(sendTemplateEmail("welcome", "recipient@example.test")).rejects.toThrow(/HTTPS/);
    expect(mocks.sendLovableEmail).not.toHaveBeenCalled();
  });
});
