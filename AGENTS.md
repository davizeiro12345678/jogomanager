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
