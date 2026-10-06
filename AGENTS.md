<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Game architecture

- Keep national promotion/relegation tier links explicit in `src/game/pyramid.ts` and resolve all exchanges from one season snapshot; this preserves club counts, deterministic saves, and simultaneous moves across grouped divisions.
- Treat synced career JSON as a personal, untrusted save: only server-attested progress can grant durable achievements; multiplayer final scores must come from server replay, not client fields, to prevent fabricated wins.

- Keep season simulation sequential inside a dedicated Web Worker, not split across threads: each week depends on the preceding save; this preserves deterministic results without blocking rendering.
- Import premium sports records in bounded, resumable batches using stable source identifiers; cache immutable KTX2 and public sports images separately from private API responses.
- Limit KTX2 decoding workers from device capacity while reserving cores for rendering and the sequential match worker; saturating every core increases frame stalls.
- Reuse the existing R3F, Rapier, post-processing, BVH, GPU-detection, and motion stack before adding 3D packages; duplicate engines increase bundle size and runtime ownership conflicts.
- Send Slack notifications only from server code via `src/lib/slack.server.ts`, fire-and-forget; a Slack outage must never block purchases or matches.
- Preserve deterministic player identity while concentrating body mass in anatomical surfaces rather than uniformly scaling the whole rig; this keeps football silhouettes athletic across LODs.
- Validate new athlete rendering in an isolated career portrait before promoting it to match squads; this protects the 22-player frame budget.
