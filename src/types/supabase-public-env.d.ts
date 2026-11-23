// Public Vite variables must be declared explicitly so their static dot access
// compiles with noPropertyAccessFromIndexSignature while Vite replaces values.
// Never declare service-role or other server-only credentials on ImportMetaEnv.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined;
  readonly VITE_AUTH_MODE: string | undefined;
  readonly VITE_AUTH_PROVIDER_ALLOWLIST: string | undefined;
}
