# TheSportsDB importer Worker

This is the source for the Cloudflare Worker `sportsdb-importer`. It keeps the existing account bindings, D1 database, R2 bucket, secrets, and `*/3 * * * *` schedule. Deploy script content through the Cloudflare Worker version API so those live bindings are preserved.

## Provider safeguards

- Requires `THESPORTSDB_API_KEY` and `THESPORTSDB_IMPORT_SECRET` as Worker secrets.
- Reserves each provider attempt in D1 before making the request.
- Enforces a rolling limit of 450 requests per minute and 75,000 per 24 hours. This is a separate provider from API-Football; its quota is not raised by the Custom450 API-Football migration.
- Pauses on 429/503 responses and honors `Retry-After`.
- Keeps the team cursor on the first failed league and refreshes league metadata once per day.

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
node --test cloudflare/sportsdb-importer/api-quota.test.mjs cloudflare/sportsdb-importer/worker-security.test.mjs
```

The required quality workflow executes both test files. These tests use synthetic tokens and D1 fixtures and never use production secrets or provider traffic.
