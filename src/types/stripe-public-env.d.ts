// Public Stripe publishable key; safe for client bundles. Never declare a server secret.
interface ImportMetaEnv {
  readonly VITE_PAYMENTS_CLIENT_TOKEN: string | undefined;
}
