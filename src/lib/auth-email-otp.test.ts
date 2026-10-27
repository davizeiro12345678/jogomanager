import { describe, expect, it, vi } from "vitest";
import { requestExistingEmailOtp, verifyExistingEmailOtp, type EmailOtpAuth } from "./auth-email-otp";

function provider() {
  const signInWithOtp = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
  const verifyOtp = vi.fn().mockResolvedValue({ data: { session: { access_token: "fixture" } }, error: null });
  return { signInWithOtp, verifyOtp, auth: { signInWithOtp, verifyOtp } as unknown as EmailOtpAuth };
}

describe("email OTP authentication", () => {
  it("requests sign-in without ever registering an unknown account", async () => {
    const p = provider();
    await expect(requestExistingEmailOtp(p.auth, "  person@example.test ", "https://example.test/auth?next=%2Fclub"))
      .resolves.toBe("person@example.test");
    expect(p.signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      email: "person@example.test",
      options: { shouldCreateUser: false, emailRedirectTo: "https://example.test/auth?next=%2Fclub" },
    });
    expect(p.verifyOtp).not.toHaveBeenCalled();
  });

  it("does not request provider delivery for a missing email", async () => {
    const p = provider();
    await expect(requestExistingEmailOtp(p.auth, "   ", "https://example.test")).rejects.toThrow(/email/i);
    expect(p.signInWithOtp).not.toHaveBeenCalled();
  });

  it("normalizes code, passes email OTP type and requires an issued session", async () => {
    const p = provider();
    await expect(verifyExistingEmailOtp(p.auth, " person@example.test ", " 123456 ")).resolves.toBeUndefined();
    expect(p.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      email: "person@example.test", token: "123456", type: "email",
    });
    expect(p.signInWithOtp).not.toHaveBeenCalled();
  });

  it("refuses blank codes without contacting the provider", async () => {
    const p = provider();
    await expect(verifyExistingEmailOtp(p.auth, "person@example.test", "  ")).rejects.toThrow(/code/i);
    expect(p.verifyOtp).not.toHaveBeenCalled();
  });

  it("propagates invalid/expired OTP and does not accept a response without a session", async () => {
    const p = provider();
    const expired = Object.assign(new Error("Code expired"), { code: "otp_expired" });
    p.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: expired });
    await expect(verifyExistingEmailOtp(p.auth, "person@example.test", "000000")).rejects.toBe(expired);
    p.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(verifyExistingEmailOtp(p.auth, "person@example.test", "000000")).rejects.toThrow(/session/);
  });

  it("propagates delivery errors instead of displaying confirmation or attempting verification", async () => {
    const p = provider();
    const rateLimited = Object.assign(new Error("Rate limited"), { code: "over_email_send_rate_limit" });
    p.signInWithOtp.mockResolvedValueOnce({ data: null, error: rateLimited });
    await expect(requestExistingEmailOtp(p.auth, "person@example.test", "https://example.test")).rejects.toBe(rateLimited);
    expect(p.verifyOtp).not.toHaveBeenCalled();
  });
});
