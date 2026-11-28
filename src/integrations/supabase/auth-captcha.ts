import type { AuthMode } from "@/lib/auth-policy";

/** A challenge is valid for exactly one protected request, even when that request fails. */
export function takeCaptchaOptions(
  required: boolean,
  token: { current: string | null },
): { captchaToken?: string } {
  if (!required) return {};
  const value = token.current;
  token.current = null;
  if (!value?.trim()) throw new Error("Conclua a verificação de segurança antes de continuar.");
  return { captchaToken: value };
}

export function needsAuthCaptcha(mode: AuthMode, otpSent: boolean): boolean {
  return mode !== "update" && !(mode === "magic" && otpSent);
}
