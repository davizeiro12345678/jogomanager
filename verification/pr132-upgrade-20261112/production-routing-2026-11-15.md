# Public routing divergence — 2026-11-15

Anonymous GETs on 15 November produced different responses for the same paths:

| Host                    | `/api/health`                                                 | League tables                       |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------- |
| `jogomanager.com`       | 503, degraded, release commit null                            | Brasileirão and Premier League: 500 |
| `jogar.jogomanager.com` | 200, ready, commit `0856c2afc3c71c7d8317e49d8bde3f0634aa0e88` | Both: 200                           |

The apex homepage referenced `index-DQlklpge.js` and a browser client built
for the old Supabase project; the `jogar` homepage referenced
`index-DaZCy4Sj.js`. A separate inspection found that the latter's Supabase
browser client lacked the public URL and publishable key. HTTP 200 on the
alternate host therefore does not establish functional browser login.

Cloudflare's account reports the zone active, the expected authoritative
nameservers and `jogomanager-web` assigned to the apex custom domain and route.
However, Cloudflare Request Trace returned “hostname does not belong to your
account” for both the apex and `www`, while tracing `jogar` and `fallback`
identified `jogomanager-web`. Recent Worker invocation logs likewise included
the alternate hosts but did not correlate the sampled apex requests.

The old Lovable project remains published and its `stadium-stewards.lovable.app`
hostname redirected to the apex during the check. Earlier migration notes
(`docs/dns-before-cloudflare-migration.md`) describe a prior situation in
which a Lovable custom-hostname association took precedence until it was
disconnected. A residual or renewed association is a plausible explanation,
not a confirmed cause or evidence of malicious activity. Inspect the current
Lovable domain association and Cloudflare hostname ownership with the providers
before changing DNS, routes or domain ownership.

Production must not be switched solely on the alternate host's healthy SSR:
first validate the browser Supabase configuration, pass the release gates,
confirm payments and sessions, and prepare a rollback. No routing or DNS
change was made during this investigation.
