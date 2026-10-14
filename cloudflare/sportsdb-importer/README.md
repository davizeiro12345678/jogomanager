# TheSportsDB importer Worker

This is the source for the Cloudflare Worker `sportsdb-importer`. It keeps the existing account bindings, D1 database, R2 bucket, secrets, and `*/3 * * * *` schedule. Deploy script content through the Cloudflare Worker version API so those live bindings are preserved.

## Provider safeguards

- Requires `THESPORTSDB_API_KEY` and `THESPORTSDB_IMPORT_SECRET` as Worker secrets.
- Reserves each provider attempt in D1 before making the request.
- Enforces a rolling limit of 450 requests per minute and 75,000 per 24 hours.
- Pauses on 429/503 responses and honors `Retry-After`.
- Keeps the team cursor on the first failed league and refreshes league metadata once per day.
- `GET /api/status` reports whether import is active, paused, or stalled, with cursor, usage, and last provider success.

Run the isolated quota and Worker tests without contacting TheSportsDB:

```sh
node --test cloudflare/sportsdb-importer/api-quota.test.mjs
```
