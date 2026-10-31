# Durable transactional notifications: release runbook

State: implementation in draft PR #96 only. DO NOT enable until its full CI gates pass.
This outbox is for asynchronous **game** messages. Supabase Auth OTP, signup
confirmation and password reset continue to use the separate direct SMTP path.

## Architecture and guarantees

- PostgreSQL private `notification_private.outbox` stores pending notifications.
- Public-schema RPC wrappers execute as `SECURITY INVOKER` and allow only `service_role`.
  `anon` and `authenticated` cannot read recipients, rendered bodies, retry state or leases.
- A stable caller-supplied idempotency key is hashed with template and recipient.
  Unique `dedupe_key` prevents multiple queue rows for a logical notification.
- Worker `scripts/notification-outbox-worker.mjs --once` claims five jobs using
  `FOR UPDATE SKIP LOCKED` and a five-minute lease token. Success is recorded
  only when Resend returns success; stale acknowledgements are rejected.
- Temporary provider/network failures are retried with bounded backoff.
  Permanent provider errors and exhausted attempts go to dead letters.
  Expired leases are reclaimed and stale jobs stop after twelve hours.
  Completed payloads are cleared and old terminal rows are periodically deleted.
- A W3C `traceparent` accompanies enqueue, claim, provider delivery and ack,
  and trace IDs are retained for safe correlation without logging message content.
- This is **at-least-once processing**, not universal exactly-once delivery:
  idempotency depends on provider retention and bounded retry duration.

## Deployment prerequisites

1. Full GitHub CI green on the exact release commit, including lint,
   migration replay, contracts, Lighthouse mobile, MatchSim and bundles.
2. Apply migration `20261029184000_private_notification_outbox.sql`
   through the normal controlled production migration process.
3. Provision server-only secrets `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` in the worker's secure
   environment. Do not commit or expose them through the browser.
4. Run `node --test scripts/notification-outbox-worker.test.mjs`.
5. Run `node scripts/notification-outbox-worker.mjs --once` against a test
   queue with an explicitly authorized test inbox. Verify one delivered
   email, one retry, one permanent rejection and expired-lease reclamation.
6. Schedule `--once` at most once every minute via the authorized VPS scheduler
   or managed job runner. Parallel invocations are safe because of row leases,
   but note provider rate limits and usage budget.
7. After end-to-end checks, set `TRANSACTIONAL_EMAIL_PROVIDER=resend` and
   `TRANSACTIONAL_EMAIL_OUTBOX=true` for the application **server only**.
   Producers must pass a stable `idempotencyKey`. Authentication emails are
   never queued. The application returns `reason: "queued"`, not `sent: true`.

## Incident response and rollback

- First disable `TRANSACTIONAL_EMAIL_OUTBOX` on the application server.
  Existing jobs remain in PostgreSQL; do not delete pending notifications
  without an incident-specific assessment and retained evidence.
- Stop the worker scheduler. Inspect `status`, `attempts`, `run_after`,
  `created_at`, `last_error` and anonymous `trace_id` from service-only access.
- Restore a healthy provider before restarting. Avoid increasing rate limits
  when delivery is failing due to invalid credentials or abuse.
- Do not disable TOTP enforcement, email confirmation, webhook signatures,
  row security or production release gates as a recovery shortcut.
- In a 12-hour-old backlog, exhausted jobs are dead-lettered intentionally
  to avoid repeating provider messages outside the bounded dedupe window.
  Recovery after that requires review, not blindly replaying all jobs.

## What this PR does not do

- It does NOT activate Supabase Auth custom SMTP: that needs a real Resend
  sending credential in the Supabase Auth SMTP configuration.
- It does NOT install the worker scheduler on the disconnected VPS.
- It does NOT enable FCM push or Twilio SMS, nor claim production delivery.
- Trace correlation across the notification pipeline is not a full APM
  collector. Extend trace propagation to game gateway and payment spans
  separately after verifying privacy, latency and cardinality budgets.

## VPS systemd deployment after the machine reconnects

The repository contains staged templates in `deploy/systemd/`. They are NOT
installed on the VPS by this PR. In an authorized root shell on the actual VPS,
after verifying the runtime path and a working Node installation:

- Create a dedicated unprivileged `jogomanager` system account with no login.
- Deploy the approved SHA to `/opt/jogomanager/current`, or adapt the paths
  in the service unit to the *actual* deployment directory.
- Provision `/etc/jogomanager/notification-outbox.env` with strictly root-only
  access (mode 0600), using the secure secrets manager. Populate
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` without
  pasting their contents into chat, commits or world-readable shell history.
- Only after migration replay, a controlled test delivery, and green release
  gates, copy both units to `/etc/systemd/system/`; run `systemctl daemon-reload`
  and `systemctl enable --now jogomanager-notification-outbox.timer`.
- Observe `systemctl list-timers`, `systemctl status
  jogomanager-notification-outbox.service` and `journalctl -u
  jogomanager-notification-outbox.service`. No email body, address or secret
  should appear in journal messages.

The service uses an unprivileged user, read-only system protection, no new
privileges, and a one-batch run. The timer avoids duplicate runs of the same
unit. PostgreSQL lease tokens provide additional protection against a second
scheduler or a stale worker on another server.
