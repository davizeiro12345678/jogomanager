/// <reference types="vite/client" />

// Vite replaces these public values at build time.
// Declare them explicitly so strict noPropertyAccessFromIndexSignature
// permits the static dot notation required by the Vite transform.
interface ImportMetaEnv {
  readonly VITE_AUTH_TURNSTILE_SITE_KEY: string | undefined;
  readonly VITE_PAYMENTS_CLIENT_TOKEN: string | undefined;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}
