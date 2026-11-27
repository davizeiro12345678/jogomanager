# Authentication methods

The `/auth` screen reads the active project's public `/auth/v1/settings` endpoint on each visit. It displays only enabled OAuth providers and supports every built-in provider accepted by the installed Supabase SDK, plus custom OIDC providers. Failed discovery offers retry; it never invents enabled providers.

The tracked development and production environment files select the active project using its public URL and publishable key; private credentials are not added to these files.

The configuration checked on 2026-10-02 enabled Google, Microsoft/Azure, Discord, Facebook, GitHub, LinkedIn OIDC, Spotify and Figma, email authentication and passkeys. Apple, phone, anonymous users and SAML were disabled. These observations are a validation snapshot, not a hardcoded UI list.

Email supports password sign-in, signup and confirmation, recovery, and passwordless access. Passwordless requests use `shouldCreateUser: false`. Players can open the received link or enter an email OTP if the project's email template includes a code. All callbacks keep the validated local `next` destination and use the existing PKCE session flow.

Passkey login uses Supabase's experimental WebAuthn API. Signed-in players can register a passkey from `/perfil`; the browser handles biometrics and security keys, while Supabase verifies credentials. Registration requires a confirmed account. The server's relying party ID and allowed origins must match the address where the game is served. Do not change those settings as part of a frontend rollout.

## Server protection

The frontend does not require CAPTCHA, as requested. After the project owner disabled server CAPTCHA protection on 2026-10-02, an invalid email/password probe returned `invalid_credentials` and a passkey challenge succeeded. No email, account or credential was created by those probes. The challenge still advertised `localhost` as its relying party ID; production passkeys need an RP ID and allowed origins compatible with `https://jogomanager.com`.

## Google redirect configuration

Google's authorized redirect URI is the Supabase callback, separate from the application's `redirectTo`/`next` destination. The live request from `jogomanager.com` uses `https://lguqnwvsfeefxamzeyos.supabase.co/auth/v1/callback`. On 2026-10-02 the Google Web client `177929318232-d5fte7bi8e52p0k18co4g38si4cvuiqe.apps.googleusercontent.com` had no authorized redirect URIs. That exact callback was added and saved while preserving the existing JavaScript origin. A fresh login attempt then reached Google's account chooser without `redirect_uri_mismatch`.

Reference: [Supabase Google login setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google OAuth redirect matching](https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch).

## Validation boundaries

### Recovery when the Lovable OAuth broker is unavailable

Password, email link/code, recovery and passkey flows already use the configured Supabase project directly. They do not require a successful Lovable OAuth broker response. They still require that project's Auth service and configured delivery provider to be available.

For Google, Apple or Microsoft broker outages, `VITE_AUTH_DIRECT_PROVIDER_ALLOWLIST` can explicitly list providers with independently configured OAuth credentials in **the same Supabase project** (for example `google,azure`). Enabled providers in that list receive an explicit alternative sign-in button, which goes directly to Supabase without starting the Lovable broker. This manual path works independently of whether the broker returns a readable error. Keep this list empty until each direct callback has been validated. `VITE_AUTH_MODE=supabase-direct` remains the explicit deployment-wide direct mode.

The installed Lovable SDK redirects top-level windows before an HTTP error can reach the caller and turns iframe errors into plain `Error` descriptions. Consequently, automatic recovery of a credit failure after an external redirect is **not verified or guaranteed**. The helper can recover recognized transport/adapter errors before a redirect; it never starts a competing flow after `redirected: true`, infers direct credentials from managed flags or retries cancellation, account denial, rate limits or MFA errors. Use the explicit alternative button or email if the broker's external page fails.

This is broker recovery, not a second Auth deployment. A separate Supabase project has separate users, UUIDs, signing keys and token issuers. Real infrastructure failover requires a verified migration/replication procedure for identities and password hashes, a reviewed JWT trust configuration, RLS isolation by issuer and recovery drills. Reusing an email in a second project does not transfer a career, wallet or identity. Never switch the public URL/key automatically after a login error.

References: [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [JWT issuer restrictions](https://supabase.com/docs/guides/auth/third-party/custom-oidc).

Tests cover provider discovery, disabled flags, Lovable compatibility, Microsoft scopes, safe callback destinations, passkey capability/error handling, and rendered login options. A live OAuth authorization redirect verifies provider launch, not account consent or the completed callback. Complete email delivery and biometric sign-in require an actual player account, server settings compatible with requests without CAPTCHA, and an allowed production origin.
