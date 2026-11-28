import { describe, expect, it } from "vitest";
import { takeCaptchaOptions, needsAuthCaptcha } from "./auth-captcha";

describe("single-use Supabase CAPTCHA", () => {
  it("passes a solved challenge once and rejects reuse", () => {
    const token = { current: "synthetic-token" };
    expect(takeCaptchaOptions(true, token)).toEqual({ captchaToken: "synthetic-token" });
    expect(token.current).toBeNull();
    expect(() => takeCaptchaOptions(true, token)).toThrow(/verificação de segurança/);
  });

  it("does not require a token if CAPTCHA is not configured", () => {
    expect(takeCaptchaOptions(false, { current: null })).toEqual({});
  });

  it("rejects an empty token even if a widget emitted it", () => {
    expect(() => takeCaptchaOptions(true, { current: " " })).toThrow(/verificação de segurança/);
  });

  it("requires a new challenge for requests but not OTP verification or password updates", () => {
    for (const mode of ["in", "up", "reset", "magic"] as const) {
      expect(needsAuthCaptcha(mode, false)).toBe(true);
    }
    expect(needsAuthCaptcha("magic", true)).toBe(false);
    expect(needsAuthCaptcha("update", false)).toBe(false);
  });
});
