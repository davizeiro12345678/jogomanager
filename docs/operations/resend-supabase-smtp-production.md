# Supabase Auth + Resend: production SMTP rollout

Status: **not yet activated by this PR**. Keep this change in the PR as an operations checklist. Never store API keys in Git, CI logs, URLs, frontend environment variables, or issue comments.

## Observed configuration (29 October 2026)

- Supabase project: `lguqnwvsfeefxamzeyos` (JogoManager production).
- Resend verified sending domain: `jogomanager.com`, sending enabled.
- The existing Resend delivery webhook targets `/functions/v1/resend-delivery-events` in the Supabase project and subscribes to delivered, delayed, failed, bounced, complained, suppressed, and sent events.
- The webhook's existence **does not** mean Supabase Auth uses Resend SMTP. Existing Resend API key metadata cannot reveal its password, and this PR does not create or rotate a credential.
- There were no Resend transactional sends or webhook deliveries observed in the examined period (20–29 October 2026). That is **not proof** of SMTP failure or success.

## Secrets and configuration (authorized operator, dashboard only)

1. In Resend, use a domain-restricted, sending-only API key, stored only in the Supabase Auth SMTP secret field. If one must be created, capture it through an authorized secret-handling path and do not paste it into a GitHub PR or a browser console.
2. Open [Supabase custom SMTP settings](https://supabase.com/dashboard/project/lguqnwvsfeefxamzeyos/auth/smtp) under **Authentication > SMTP Settings** (the dashboard may display it under **Notifications > Email**).
3. Set **Enable custom SMTP** and configure:
   - Host: `smtp.resend.com`
   - Port: `465` (TLS; use only provider-documented compatible options)
   - Username: `resend`
   - Password: the **Resend API key**, supplied via the dashboard secret input
   - Sender address: an approved address at the verified sending domain, such as `no-reply@jogomanager.com` after confirming sender policy
   - Sender name: `JogoManager`
4. Preserve email confirmation, email change verification, and password-reset protections. Confirm expected redirect URLs and email templates before changing production settings.
5. Configure abuse defenses (CAPTCHA/Turnstile for signups and password-reset flows), appropriate per-user/email rate limits, and separate promotional sending from authentication traffic.
6. Confirm the domain's SPF, DKIM, and DMARC are valid. Do not proxy email DNS records (MX, DKIM, SPF) through the CDN.

## Acceptance testing (must be done before release)

- Use a designated test inbox with explicit authorization. Send one signup confirmation, one password-reset email, and one magic-link/OTP if the product supports them.
- Confirm authentication links use the expected public origin and are single-use, expire as expected, and cannot be reused.
- Inspect Resend's real event history (delivered, bounced, delayed) and verify matching signed webhook events are persisted exactly once; test duplicate event IDs.
- Simulate malformed JSON, wrong signature, outdated timestamp, and oversized chunked webhook bodies. Assert 400/401/413 responses and **no privileged database write**.
- Verify suppressed/bounced recipients do not cause uncontrolled retry storms or blocked signup loops.
- Keep SMS login independent: the staged Twilio hook is **not** activated just because this SMTP change is applied.
- Alert on sudden failed/bounced rate, delivery latency, or queue backlog without logging full OTPs, private emails, or message bodies.

## Rollback and troubleshooting

- If authentication mail delivery fails, revert the SMTP provider configuration using the dashboard and previously approved emergency provider; do **not** silently disable confirmation or expose SMTP credentials.
- Inspect Supabase Auth logs and Resend delivery metrics with a bounded period. Check sender verification, credentials, rate limits, and actual provider SMTP failures before adjusting limits.
- Restore the previous rate limits once the incident is over. Rotate credentials only if exposure or a specific compromise is suspected.
- CDN is already provided by the domain's **Cloudflare Free** zone, with HTTPS, HTTP/3, Brotli, WAF and static asset caching active. Do not deploy a competing generic GitHub Pages CDN for protected game endpoints.
- Keep API, authenticated saves, purchases, webhooks and OTP flows **uncached**, even while optimizing public 3D assets.

## References

- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Resend integration: https://resend.com/docs/send-with-supabase-smtp
- Cloudflare caching and security: https://developers.cloudflare.com/cache/
