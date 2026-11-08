import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendLovableEmail: vi.fn() }));

vi.mock("@lovable.dev/email-js", () => ({
  EmailAPIError: class EmailAPIError extends Error {},
  sendLovableEmail: mocks.sendLovableEmail,
}));

import { sendTemplateEmail, validateEmailAddress, validateLovableSendUrl } from "./send-email";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("server email URL configuration", () => {
  it("accepts only the explicit Lovable email endpoint", () => {
    expect(validateLovableSendUrl("https://api.lovable.dev/v1/messaging/email/send")).toBe(
      "https://api.lovable.dev/v1/messaging/email/send",
    );
    expect(validateLovableSendUrl("https://api.lovable.dev:443/v1/messaging/email/send")).toBe(
      "https://api.lovable.dev:443/v1/messaging/email/send",
    );
  });

  it.each([
    "http://api.lovable.dev/v1/messaging/email/send",
    "https://api.example.test/v1/messaging/email/send",
    "https://127.0.0.1/v1/messaging/email/send",
    "https://[::1]/v1/messaging/email/send",
    "https://169.254.169.254/v1/messaging/email/send",
    "https://localhost/v1/messaging/email/send",
    "https://api.lovable.dev:8443/v1/messaging/email/send",
    "https://api.lovable.dev/v1/messaging/email/other",
    "https://api.lovable.dev/v1/messaging/email/send?redirect=https%3A%2F%2F127.0.0.1",
    "https://user:pass@api.lovable.dev/v1/messaging/email/send",
    "https://api.lovable.dev/v1/messaging/email/send#fragment",
  ])("rejects an unapproved or redirecting endpoint: %s", (url) => {
    expect(() => validateLovableSendUrl(url)).toThrow();
  });

  it("rejects malformed recipient and reply-to addresses without echoing them", async () => {
    const personalValue = "attacker@example.test\nBcc: victim@example.test";
    expect(() => validateEmailAddress(personalValue, "Recipient")).toThrow(
      "Recipient must be a valid email address.",
    );
    expect(() => validateEmailAddress(personalValue, "Reply-To")).toThrow(
      "Reply-To must be a valid email address.",
    );
    let errorMessage = "";
    try {
      validateEmailAddress(personalValue, "Recipient");
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    expect(errorMessage).not.toContain(personalValue);
  });

  it("rejects an insecure configured send URL before invoking the SDK", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-lovable-key");
    vi.stubEnv("LOVABLE_SEND_URL", "http://localhost:8787/send");

    await expect(sendTemplateEmail("welcome", "recipient@example.test")).rejects.toThrow(/HTTPS/);
    expect(mocks.sendLovableEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipient or reply-to before invoking the SDK", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-lovable-key");
    vi.stubEnv("LOVABLE_SEND_URL", "https://api.lovable.dev/v1/messaging/email/send");

    await expect(sendTemplateEmail("welcome", "not-an-email")).rejects.toThrow(/Recipient/);
    await expect(
      sendTemplateEmail("welcome", "recipient@example.test", { replyTo: "invalid" }),
    ).rejects.toThrow(/Reply-To/);
    expect(mocks.sendLovableEmail).not.toHaveBeenCalled();
  });
});
