# Authentication methods

The `/auth` screen reads the active project's public `/auth/v1/settings` endpoint on each visit. It displays only enabled OAuth providers and supports every built-in provider accepted by the installed Supabase SDK, plus custom OIDC providers. Failed discovery offers retry; it never invents enabled providers.

The tracked development and production environment files select the active project using its public URL and publishable key; private credentials are not added to these files.

The configuration checked on 2026-10-02 enabled Google, Microsoft/Azure, Discord, Facebook, GitHub, LinkedIn OIDC, Spotify and Figma, email authentication and passkeys. Apple, phone, anonymous users and SAML were disabled. These observations are a validation snapshot, not a hardcoded UI list.

Email supports password sign-in, signup and confirmation, recovery, and passwordless access. Passwordless requests use `shouldCreateUser: false`. Players can open the received link or enter an email OTP if the project's email template includes a code. All callbacks keep the validated local `next` destination and use the existing PKCE session flow.

Passkey login uses Supabase's experimental WebAuthn API. Signed-in players can register a passkey from `/perfil`; the browser handles biometrics and security keys, while Supabase verifies credentials. Registration requires a confirmed account. The server's relying party ID and allowed origins must match the address where the game is served. Do not change those settings as part of a frontend rollout.

## Server protection

The frontend does not require CAPTCHA, as requested. The last live passkey challenge on 2026-10-02 returned `captcha_failed` because Supabase still required a CAPTCHA token. Email and passkey sign-in can only complete without a widget if the project's Auth protection settings accept those requests without a CAPTCHA token. The public settings endpoint does not expose that configuration, and no server protection setting was changed by this frontend update. The UI reports this server error and offers linked-account access.

## Validation boundaries

Tests cover provider discovery, disabled flags, Lovable compatibility, Microsoft scopes, safe callback destinations, passkey capability/error handling, and rendered login options. A live OAuth authorization redirect verifies provider launch, not account consent or the completed callback. Complete email delivery and biometric sign-in require an actual player account, server settings compatible with requests without CAPTCHA, and an allowed production origin.
