// Explicit Vite flags allow static substitution and dead-code elimination.
// Never use bracket-based import.meta.env access for build-time flags.
interface ImportMetaEnv {
  readonly VITE_PHONE_AUTH_ENABLED: string | undefined;
  readonly VITE_PHONE_MFA_ENABLED: string | undefined;
}
