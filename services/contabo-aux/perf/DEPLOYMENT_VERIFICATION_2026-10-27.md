# Public catalog rollout verification (2026-10-27)

The **VPS gateway and public Nginx API route are now deployed**.
Do not confuse this with the frontend deployment: the site-side client changes
remain in this draft PR, and Lighthouse mobile CI is failing.

## Deployment
- SSH target verified: Contabo VPS hostname `vmi3695183`, 8 vCPU, ~24 GB RAM.
- Gateway source patch applied after `--check` success. Original file backup:
  `/srv/jogomanager/public-gateway/gateway.mjs.pre-paging-2026-10-27T23-37-47-921Z.bak`
- Docker Compose services rolled sequentially: `gateway-3`, `gateway-2`, `public-gateway`.
  All three reached **healthy**.
- Nginx `/etc/nginx/conf.d/pfm-catalog.conf`: new exact-match `GET /v1/public/crests`,
  rejects auth/cookie/API-key headers, forwards to the existing three-replica upstream.
  `nginx -t` passed and reload succeeded. Config backup:
  `/etc/nginx/conf.d/pfm-catalog.conf.pre-crests-20261027T234613Z.bak`
- External HTTPS `https://catalog.jogomanager.com/v1/public/crests?limit=1` returned 200.
  1,000-item GET returned 200 and 86,710 bytes. Limits 0 and 1001 returned HTTP 400.
  Synthetic Authorization header returned HTTP 400.

## Full-catalog integrity
A **read-only** 39-page walk through one updated VPS gateway completed in 12.404 seconds:
- 38,854 clubs with 38,854 distinct IDs; 33,112 non-null crests.
- Each object has only `id` and `crest_url`.
- Content MD5 sorted by ID (tab between fields, LF between rows):
  `7b5a0ab08d3e2fb579ccbbcc82692d98`.
- Direct SQL hash in Supabase: identical.

## Real VPS performance, not a system-wide performance claim
- Sysbench CPU, 8 threads, 3 s, default prime=10,000: before 9,232.17 events/s;
  after 8,881.63 events/s. Different samples, shared host, no causal claim.
- Same original public route `/v1/public/clubs?limit=50`, local loopback,
  wrk -t2 -c16 -d5s --latency: before 3,352.07 requests/s, p99 581.22 ms;
  later 3,596.19 requests/s, p99 49.98 ms. Cache warmth and VPS load were not
  controlled, so no proven speedup attributable to code.
- New public route `/v1/public/crests?limit=50`,
  wrk -t2 -c16 -d3s: 2,823.98 requests/s.

## Remaining gates
- PR #86 has passing build, types, tests, CodSpeed and SQL migration checks,
  but Lighthouse mobile multi-page audit fails on homepage, guides and
  quick-match pages, independently of the VPS deployment.
- The production frontend must not enable `VPS_CATALOG_ENABLED` until client
  code in this PR is deployed and verified: the old client caps at 7,200 rows.
- No Auth, Stripe, multiplayer or save endpoints were changed in this rollout.
