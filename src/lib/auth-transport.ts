import type { SocialProvider } from "@/integrations/supabase/social-auth";
import { authErrorMessage, type AuthMode } from "./auth-policy";

/** OAuth identity is always owned by the configured Supabase project. */
export function oauthTransport(_mode: unknown, provider: SocialProvider) {
  return { kind: "supabase", provider } as const;
}

/** Explain unavailable direct providers without disclosing raw upstream errors. */
export function socialAuthErrorMessage(error: unknown, mode: AuthMode): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (
    code === "provider_disabled" ||
    code === "oauth_provider_not_supported" ||
    (code === "validation_failed" &&
      /unsupported provider|provider.*(?:not enabled|disabled)/i.test(message))
  ) {
    return "Este provedor não está configurado para entrada direta. Use e-mail ou outro método disponível.";
  }
  return authErrorMessage(error, mode);
}
