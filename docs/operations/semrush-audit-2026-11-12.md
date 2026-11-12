# Semrush crawl audit — 12 Nov 2026

## Evidence and scope

The Semrush screenshots provided on 12 Nov 2026 show:
- 14 broken internal links;
- 12 5XX pages;
- 12 invalid pages in sitemap.xml;
- 16 external nofollow links;
- 14 pages that blocked the Semrush crawler;
- 5 pages with X-Robots-Tag noindex;
- 3 pages orphaned in Google Analytics;
- 2 URLs with permanent redirects;
- 1 orphan URL in a sitemap.

**These are occurrence counts, not 79 proven distinct URLs.** The screenshots do not contain the affected URLs, status codes, request timestamps, Cloudflare Ray IDs, or referring pages. No issue may be marked resolved from counts alone.

## Code-level change in this branch

`getLeagueTable` previously failed the entire server-side league page if either *optional* injury or scorer reads failed. All 12 indexable league pages share that projection. Use `Promise.allSettled` for the optional reads, preserving standings if one ancillary read fails, with empty optional fields and a generic log line. A missing or failed **primary standings** request is still an error and remains retryable; do not serve fabricated tables.

## After deploying this PR, verify exact URLs

1. Export the affected URLs from the **current** Semrush Site Audit and group by error type, URL, HTTP status, time, and source page. Compare the crawl date with the deployed SHA.
2. For all 12 listed 5XX URLs, repeat public, no-cookie GET and HEAD requests using a normal client and a crawler-like client; capture status, `cf-ray`, location, content-type, `x-robots-tag`, and `cache-control`. Diagnose 500/502/503/520/522 independently rather than suppressing them.
3. Confirm every canonical sitemap `<loc>` returns HTTP 200 without a redirect or `noindex`. The current source shares `PUBLIC_PAGE_INVENTORY` with the indexable HTTP policy, but that is **not proof of production health**. Exclude private/auth/match pages from indexing even if Semrush warns.
4. Resolve broken links at their source to the final canonical URL. Keep legitimate HTTP 301 for retired aliases and external `rel=nofollow` for unendorsed or user-generated links.
5. Compare Semrush crawler rejections with Cloudflare Security Events. Adjust only the matching challenge rule if verified legitimate traffic is blocked; never broadly disable the WAF, bot protection or rate limiting.
6. Reconcile Google Analytics orphan-page reports against actual nav links, canonical, indexing policy and sitemap. Analytics events alone do not prove a page is crawlable.
7. Rerun Semrush after deployment and edge-cache propagation. Only merge additional fixes when precise URL-level evidence and green TypeScript, ESLint, Prettier, Vitest and build results support them.

## Safety

No DNS, WAF, authentication, database schema, search indexing or production deployment settings are changed by this PR. A page that is unavailable due to the **primary** data source is not silently converted into a successful blank or false page.
