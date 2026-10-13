# Internationalization remediation status (2026-10-13)

The supported locale selector lists many BCP-47 languages, but **a listed language is not proof of complete translation**.

## Work in this change
- Commerce checkout/claim and coupon UI messages are localized for pt-BR, en, es, fr, de, it, ar and ja. pt-PT temporarily uses pt-BR; other locales fall back to English.
- Never translate Stripe IDs, coupon redemption codes, account identifiers, brand names, or API-specific fields.
- Keep all commercial validation authoritative in the server and PostgreSQL regardless of displayed language.
- Dedicated lightweight dictionary keeps checkout code independent from large game packs.

## Remaining work before claiming full-site translation
- Audit every public editorial route listed in `src/i18n/provider.tsx` as Portuguese-only, plus game pages, meta descriptions, alt text, screen-reader labels, validation errors, toast messages, authentication, checkout, legal text, Resend transactional templates, e-mails, and push notifications.
- Extract hard-coded strings to typed keys. Translate locale-by-locale; do not mark untranslated strings as localized. Require native-language review for purchase/consent/legal content.
- Use localized server-rendered routes (or well-configured language routing), correct `hreflang`, canonical URLs and `<html lang>` only when the page really is translated.
- Validate RTL layouts (ar, he, fa, ur...), variable interpolation, pluralization, numerals, time zones, large text, Unicode fonts, mobile viewports, and graceful fallbacks.
- Measure actual translation-key coverage per route and language, and track it as a nonblocking report until budgets are set for locale-specific quality gates.
- The key `language.coverage` in interface-messages already discloses partial availability; do not remove that warning prematurely.

## Security dependencies
Official/creator coupon codes now need `public.coupon_eligible_users` authorization. Only service_role can assign entitlements. Guest purchase claiming requires confirmed Supabase Auth email and signed Stripe proof.

## Firebase
The Firebase *web* configuration is public; never expose a general-purpose server `GOOGLE_API_KEY` to the client. Events must stay behind explicit analytics consent, and duplicate gtag/Firebase Analytics configuration must be avoided. Restrict the Firebase web key by authorized domains/API permissions in the Google console.
