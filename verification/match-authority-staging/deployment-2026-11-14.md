# Match authority staging deployment — 2026-11-14

At 22:39 UTC, the full `services/match-authority/worker.ts` from commit
`f61f35522a2c6fb8566a6695512874fb71941c2d` was deployed to the existing
`jogomanager-match-authority-staging` Worker using the operator's authenticated
Wrangler session. Cloudflare reported version
`d924f07c-efaf-47f1-8551-dde8289ebff6`.

After deployment, authenticated Cloudflare reads confirmed:

- `MATCH_AUTHORITY_ENABLED=false`, `MATCH_QUEUE_CRON_ENABLED=false`, and
  `MATCH_AUTHORITY_ENV=staging`.
- `ALLOWED_ORIGIN=https://staging.jogomanager.com`, no Workers.dev or preview,
  no Worker domain or zone route, and no cron schedules.
- The `MATCH_ROOMS` binding still points to the existing SQLite
  `MatchRoomDO` namespace `bdbb41fa3f1046d3b12c20c9ff87d1ea`; its ID
  was unchanged by deployment. No production DB key was added.

The original config replayed a create-class migration and Cloudflare rejected
it with error 10074 because the class already existed. The successful deployment
used a declarative live SQLite export for that class instead. The staging
configuration was updated to match; the separate production configuration was
not changed. For future class lifecycle changes, review Cloudflare's rollback
constraints and preserve the namespace and data.

Before deployment, the exact Worker passed Wrangler dry-run. Local disabled
loopback smoke checks returned 404 for all six requests, including WebSocket
upgrade and token-in-query attempts. The Vitest include pattern initially
excluded the three `services/match-authority` test files; after correcting it,
11 directed files / 114 tests passed, including 18 tests in those three files.

This is a deployment of a disabled and unrouted staging Worker, not a remote
end-to-end gameplay test. A separate Supabase staging project, its migrations
and least-privilege credentials, private ingress, real-device multiplayer,
rollback exercise and performance/thermal campaigns remain outstanding.
