# Store checkout configuration

The public catalog remains readable while checkout is unavailable. The store reads a server availability function before offering account or guest payments. That function returns only enabled flags and player-facing messages. Each session-creation handler independently enforces the required configuration, including the environment of the deployed browser key and the signing secret needed for trusted fulfillment.

## Cloudflare production

`jogomanager.com` routes to the `jogomanager-web` Worker. On 2026-10-02 its runtime bindings included the correct public Supabase URL/key, public Stripe key and `SUPABASE_SERVICE_ROLE_KEY`. It had no private Stripe API key, payment webhook signing secret, guest email hash secret or guest activation flag. This prevents session creation and verified delivery; a public `pk_live_` key alone cannot create a checkout.

Configure private values in Cloudflare Worker secrets, never in Git, `VITE_*` variables, chat, or Wrangler `vars`:

| Secret                             | Purpose                                                                                                                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STRIPE_LIVE_API_KEY`              | A native live restricted API key for the same Stripe account as the browser key. Existing Lovable gateway connection tokens additionally require `LOVABLE_API_KEY`; native Stripe keys use Stripe directly. |
| `PAYMENTS_LIVE_WEBHOOK_SECRET`     | The signing secret for the live endpoint `https://jogomanager.com/api/public/payments/webhook?env=live`.                                                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`        | Private access to the active project's catalog, intents and transactional fulfillment. Already present in the inspected Worker.                                                                             |
| `GUEST_CHECKOUT_EMAIL_HASH_SECRET` | A stable random server secret used to hash visitor emails; keep it stable across deployments.                                                                                                               |

The Stripe key needs read access to prices/products and write access to customers, Checkout Sessions, subscriptions, coupons and Billing Portal Sessions used by the existing flows. Do not grant unrelated transfer, payout or refund permissions. Configure the webhook to send the Checkout completion/async-payment events and subscription events handled in `src/routes/api/public/payments/webhook.ts`. The endpoint requires the `env` query parameter: use `?env=live` for production and `?env=sandbox` for test events. A URL without this parameter returns HTTP 400. Subscribe to both live and sandbox endpoints only when their matching environment is intentionally deployed.

Public runtime configuration for live guest purchases is `PAYMENTS_ENVIRONMENT=live`, `GUEST_CHECKOUT_ENVIRONMENT=live`, `GUEST_CHECKOUT_LIVE_ENABLED=true`, and the matching `VITE_PAYMENTS_CLIENT_TOKEN`. The browser build must use that same public key. Sandbox uses test keys, the sandbox webhook secret and `GUEST_CHECKOUT_SANDBOX_ENABLED=true`. The Cloudflare deploy script now copies the sandbox guest flag and refuses to deploy with missing payment secrets.

For secure manual entry, run `wrangler secret put <NAME> --name jogomanager-web` using the project's configured Cloudflare account, or use the Worker's Variables and Secrets settings. Do not paste secret values into shell command arguments, source files, PR descriptions or screenshots.

## Loading, retries and delivery

Account and visitor checkout use one mount lifecycle. Stripe.js loads lazily; rejected or null SDK results can be retried. The UI bounds session/SDK loading, catches asynchronous initialization errors, waits for Stripe's rendered form event, and destroys late results after closure or timeout. Closing or switching a guest product invalidates pending requests. A storage failure does not prevent opening checkout, and visitor review prices include the currently displayed promotion.

Wallet, subscription and purchase queries are scoped to the current authenticated user. The return page restarts its confirmation polling on retry, stops after errors or closure, and recognizes a season pass only from the matching server-verified subscription and wallet state. It never grants items from a browser save or a returned Stripe client secret; fulfillment remains on the trusted server paths.

Validation covers loader retries, rejection/timeout/closure, missing server configuration, environment mismatches and attested subscription delivery. No real charge, new payment key, webhook endpoint or production game deployment is created by these tests. Real payment and webhook delivery remain unverified until the private runtime configuration and the reviewed build are deployed.
