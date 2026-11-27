import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * A small structural interface implemented by Auth0's SPA SDK.
 * The ID token must come from a completed Auth0 login, never from URL parameters.
 */
export interface Auth0IdTokenSource {
  getIdTokenClaims(): Promise<{ __raw?: string } | undefined>;
}

export interface Auth0SupabasePilotConfig {
  /** Explicit opt-in: no existing Supabase Auth user/session is migrated. */
  enabled: boolean;
  supabaseUrl: string;
  publishableKey: string;
  auth0: Auth0IdTokenSource;
}

/**
 * An isolated Data API client for a *new*, explicitly Auth0-aware surface.
 *
 * NOT a substitute for the game's primary Supabase Auth client.
 * It must not access legacy UUID-owned careers, wallets, purchases, or profiles:
 * Auth0's standard "sub" is not a UUID, and auth.uid() casts "sub" to UUID.
 *
 * Supabase (not this browser helper) validates the issuer, JWT signature,
 * expiry, key ID and RLS. Do not infer authorization from decoded client claims.
 */
export function createAuth0SupabasePilotClient(config: Auth0SupabasePilotConfig) {
  if (config.enabled !== true) {
    throw new Error("Auth0 pilot is disabled");
  }

  let url: URL;
  try {
    url = new URL(config.supabaseUrl);
  } catch {
    throw new Error("Invalid Supabase URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Supabase URL must be a clean HTTPS origin");
  }
  if (!config.publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Auth0 pilot requires a public Supabase publishable key");
  }
  if (typeof config.auth0?.getIdTokenClaims !== "function") {
    throw new Error("Auth0 ID token provider is required");
  }

  return createClient<Database>(url.origin, config.publishableKey, {
    // Auth0 ID tokens carry the literal 'role' claim added by the post-login Action.
    // Auth0 access tokens may silently strip this non-namespaced claim.
    accessToken: async () => {
      const token = (await config.auth0.getIdTokenClaims())?.__raw;
      if (!token || token.trim() !== token || token.split(".").length !== 3) {
        throw new Error("A valid Auth0 login is required");
      }
      return token;
    },
    // Never share persisted sessions or callback parsing with Supabase Auth.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
