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

Tests cover provider discovery, disabled flags, Lovable compatibility, Microsoft scopes, safe callback destinations, passkey capability/error handling, and rendered login options. A live OAuth authorization redirect verifies provider launch, not account consent or the completed callback. Complete email delivery and biometric sign-in require an actual player account, server settings compatible with requests without CAPTCHA, and an allowed production origin.
