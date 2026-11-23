// Explicit public Vite environment declarations: required by
// noPropertyAccessFromIndexSignature and static Vite production substitution.
// Runtime values can be absent before deployment; never declare service-role
// or other server credentials on ImportMetaEnv.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined;
}
