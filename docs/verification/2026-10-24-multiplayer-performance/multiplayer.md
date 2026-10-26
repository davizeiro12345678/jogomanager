# Multiplayer correctness and focused security review

This increment keeps outcomes in the existing trusted replay. It adds participant-driven settlement and rematch invitations; it does not implement a new authoritative realtime server, ranked seasons, or behavioural bans.

## Corrected paths

- A guest can request the official replay even if the host disconnects.
- Leaving a live room settles its match rather than erasing its result. Waiting rooms can still be closed normally.
- An interrupted settling claim becomes recoverable after five minutes. Reclaim compares the observed timestamp; a random fencing token guards both publication and release so an older execution cannot overwrite a newer owner.
- The stadium remains mounted while settling and when displaying a valid official score. Null or malformed historical state no longer crashes the history projection. Provisional presentation scores are labelled explicitly.
- Result confirmation retries with a capped exponential backoff while online, and disposes timers on exit. Rematch creates a fresh invitation using the participant's own club and the existing server-generated private seed flow; it does not join the opponent automatically.
- Inherited object keys (`toString`, `constructor`, `__proto__`) are rejected as club identifiers before a seed lookup or replay.

## Evidence

- `npm test`: 407 files / 2,213 tests passed during the incremental session. Fresh focused run after the final server/UI edits: 31 tests / 5 files passed. Tests race a paused replay against another participant and verify outsider rejection, forged-score ignoring, active/expired leases, stale-owner fencing, retry after failure, idempotent completion, departure settlement, and inherited club keys.
- `node --test services/match-aux/signature.test.mjs`: 4 tests passed, covering trusted request signatures and rejection paths.
- TypeScript and ESLint checks passed. Production build and absolute startup bundle check passed locally. Comparative startup bundles and mobile Lighthouse remain blocked against main; no required gate was weakened.
- Motion verification: 30,720 exact body/remainder states plus 36,000 paired full-match ticks and 372 full checkpoints match reference b6368e9.

## Read-only production observations (24 October 2026)

Project `lguqnwvsfeefxamzeyos` is ACTIVE_HEALTHY. Every public table has RLS enabled. Authenticated users have SELECT, but no direct mutation grants, on match_rooms. match_room_secrets has RLS and a restrictive deny policy; browser roles have no table grants. The existing payment schema objects cited in issue 51 and the revision/tombstone career contract cited in issue 42 are present. These observations do not replace checkout or two-session integration tests. The issues remain open with the new evidence.

The checked dependency inventory had zero npm advisories. GraphQL discoverability warnings alone do not establish unauthorized row access. No blanket privilege revocation or production migration was applied.

## Limits and blockers

Server-function tests replace the authentication/database/network boundary with test doubles; they do not establish real PostgREST concurrency, MFA/session behaviour or two-browser recovery. No physical-device FPS, production load capacity, complete absence of vulnerabilities, or fully validated anticheat is claimed. Existing presentation uses a public presentation seed while final replay uses a private seed: the visual score can differ until official confirmation. Live tactical commands and continuously authoritative snapshots require further server work.

Contabo SSH responds, but root authentication was refused (`Permission denied (publickey,password)`). SentinelX is connected only to Windows WCOM-457, running as LocalSystem; WSL returns WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED under that identity. The existing staged VPS integration in PR 68 was not deployed. No password, server secret, payment data or private seed was added to git.
