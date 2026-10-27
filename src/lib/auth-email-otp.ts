import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailOtpAuth = Pick<SupabaseClient["auth"], "signInWithOtp" | "verifyOtp">;

/**
 * Request passwordless login only for an existing account.
 * This must not silently register a new player via the OTP form.
 */
export async function requestExistingEmailOtp(
  auth: EmailOtpAuth,
  email: string,
  redirectTo: string,
): Promise<string> {
  const normalized = email.trim();
  if (!normalized) throw new Error("Missing email");
  const result = await auth.signInWithOtp({
    email: normalized,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (result.error) throw result.error;
  return normalized;
}

/**
 * A valid response without a session is not an authenticated login.
 * Never navigate into a protected area until the provider has issued a session.
 */
export async function verifyExistingEmailOtp(
  auth: EmailOtpAuth,
  email: string,
  token: string,
): Promise<void> {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error("Missing OTP code");
  const result = await auth.verifyOtp({
    email: email.trim(),
    token: normalizedToken,
    type: "email",
  });
  if (result.error) throw result.error;
  if (!result.data.session) throw new Error("No verified session");
}
