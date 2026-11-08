# TheSportsDB importer Worker

This is the source for the Cloudflare Worker `sportsdb-importer`. It keeps the existing account bindings, D1 database, R2 bucket, secrets, and `*/3 * * * *` schedule. Deploy script content through the Cloudflare Worker version API so those live bindings are preserved.

## Provider safeguards

- Requires `THESPORTSDB_API_KEY` and `THESPORTSDB_IMPORT_SECRET` as Worker secrets.
- Reserves each provider attempt in D1 before making the request.
- Enforces a rolling limit of 450 requests per minute and 75,000 per 24 hours. This is a separate provider from API-Football; its quota is not raised by the Custom450 API-Football migration.
- Pauses on 429/503 responses and honors `Retry-After`.
- Keeps the team cursor on the first failed league and refreshes league metadata once per day.

## Public request limit

- Public catalog endpoints allow at most 120 requests per client address in a rolling 60-second window. Each request attempts one atomic D1 reservation write (`INSERT ... SELECT`, without a preceding usage read), so the limit is not reset by Worker isolate/POP changes. A rejected request performs one additional usage `SELECT` to calculate `Retry-After`; accepted requests do not perform that read.
- The client address is read from the trusted `CF-Connecting-IP` header; if absent, requests share one anonymous bucket. D1 stores only the HMAC-SHA-256 pseudonym and request timestamp, not the address. The existing `THESPORTSDB_IMPORT_SECRET` is used as the HMAC key: the secret is never sent by the public client and also authenticates `/init` and the other administrative routes.
- The D1 table and indexes are additive and idempotent. `/init` batches their DDL, and the first public request for each stable D1 binding object in a Worker isolate may also pay that DDL initialization cost. The scheduled cron's public-schema DDL runs in the post-import cleanup promise, not on the provider-import path. The in-memory schema/prune gate is per binding object, not a universal cache keyed by an underlying database; the quota itself remains shared by D1. If D1, its schema batch, a reservation write, the rejected-request usage read, or the HMAC key is unavailable, public requests fail closed with `503` and `Cache-Control: no-store` rather than bypassing the limit.
- Expired rows are pruned opportunistically at most once per 30 seconds while public traffic is active. The `*/3 * * * *` scheduled handler also schedules a forced public-rate `DELETE` after the import attempt, so an idle Worker is normally cleaned on the three-minute schedule without making import wait for cleanup. Cleanup is a separate D1 operation and its failure or a failed/delayed cron/D1 operation can extend retention; there is no retention SLA or guaranteed maximum retained-row age.
- Rotating `THESPORTSDB_IMPORT_SECRET` changes every HMAC pseudonym. During an overlapping rollout, old and new Worker versions can create old- and new-secret buckets for the same client, temporarily increasing the effective quota; complete the rollout before treating old buckets as expired. Rotation does not change the configured 120-request public cap once only one secret is active.
- This protects the public catalog interface; it does not change or raise TheSportsDB's separate 450/minute and 75,000/24-hour provider quota.

## Administrative authentication and cache

`/import/*`, administrative/importer settings routes and `GET /api/status` require a server-side authorization header. Use `Authorization: Bearer <THESPORTSDB_IMPORT_SECRET>`. The existing `X-Import-Secret` header remains supported for caller migration; secrets in query parameters are never accepted. Update external callers before deploying the new Worker. If a real secret was previously placed in a URL, review logs and rotate it through the authorized secret-management process.

For example, using a server-local environment variable, without embedding the value in a URL:

```sh
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${THESPORTSDB_IMPORT_SECRET}" \
  "https://<your-worker-host>/api/status"
```

Do not run that example with shell tracing, print the secret, include it in a browser URL or commit it. `/api/status` reports whether import is active, paused or stalled, with cursor, usage and last provider success. Authenticated administrative responses and all error responses use `Cache-Control: no-store`; public sports-data reads remain publicly cacheable for 60 seconds. CORS is not authorization.

## Isolated regression tests

Run quota and Worker security contracts without contacting TheSportsDB:

```sh
node --test cloudflare/sportsdb-importer/api-quota.test.mjs cloudflare/sportsdb-importer/public-rate-limit.test.mjs cloudflare/sportsdb-importer/worker-security.test.mjs
```

The required quality workflow executes all three test files. These tests use synthetic tokens and D1 fixtures and never use production secrets or provider traffic. The public-rate regression additionally uses Node `worker_threads` with separate SQLite connections to one temporary file and independent D1 wrappers over each backend; it proves the SQL cap with exactly 120 allows out of 240 concurrent requests, but it is not a substitute for a live Cloudflare D1 concurrency test. The Worker security test uses one loaded ESM module and distinct D1 binding wrappers; a `?separate-isolate` import would still share the rate-limit module cache and is therefore not presented as an isolate-isolation test.
