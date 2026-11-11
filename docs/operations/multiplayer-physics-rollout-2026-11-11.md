# Multiplayer, trust and contact physics: staging-to-release runbook

**Branch:** `integration/release-2026-11-11`, PR #132 (Draft). **Do not deploy** until exact-head CI, PostgreSQL migration replay, staging simulation and physical-device evidence pass.

## Code now present

- `src/game/online/authoritative-socket-bridge.server.ts`: strict WebSocket framing, ticket validation callback, reconnect/session replacement, ACK/NACK, max 4096-byte frames, server-only snapshots, idle timeout and slow-consumer backpressure.
- `src/game/online/authoritative-match-session.ts`: authoritative command sequence and admission/finalization; protects against cross-room command liveness side effects.
- `src/game/online/matchmaking-policy.ts`: deterministic casual/ranked selection, rating/region/time fences, block lists and recent-opponent avoidance. The backend transactional queue **does not yet exist**.
- `src/features/multiplayer/RoomChat.tsx`: reusable private chat for lobby and in-game overlay, local opponent mute, abuse-report link to authenticated support.
- `src/features/multiplayer/LiveRoom.tsx`: device graphics settings and honest visual-preview state; **not a server-snapshot LiveRoom** yet.
- `drizzle/migrations/0072_match_contact_physics_revision.sql`: old rooms keep contact model 1, new rooms default to model 2 after deployment, with a server-only UPDATE/INSERT trigger.
- `src/lib/multiplayer.functions.ts`: server replay reads the **pinned** model; the legacy auxiliary worker is excluded for model-2 rooms until it attests the same contract.
- `src/game/sim-ball-duels.ts`, `src/game/sim-team-ai.ts`, `src/game/match-physics-extras.ts`: v2 physics fixes to rescue teleports, tackling reach, keeper reach and deterministic future-ball pursuit.

## Still absent / implementation required before release

1. Cloudflare Durable Object owner, room bootstrap from an authenticated service, deployment routing, ticket signer/verifier secrets, replay-safe nonce issuance, durable command journal and storage/checkpoint recovery.
2. A client receiving **authoritative** snapshots with smoothing, resync and receipt confirmation. Today LiveRoom still renders a local non-authoritative presentation seeded from room ID, not the secret server simulation.
3. Transactional ranked matchmaking queue/rating storage and release-safe MMR updates; private/friends/invitations, tournaments, spectator and 2x2 partner permissions.
4. Moderator case-management and appeals; use existing room chat RPC and support outbox without duplicating tickets. Human review is required for account-level punitive actions.
5. Quality/performance evidence on real GPUs/phones with controlled scenes, DPR and measured per-frame latency, plus security and migration replay.

## Staging validation sequence

1. Reconfirm PR head SHA and all migration IDs. Run complete `npm ci`, `npm run lint`, `npx prettier --check` (changed files), `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run bundle:check`.
2. Run directed tests: `src/game/contact-physics-revision.test.ts`, `src/game/ai-ball-interception.test.ts`, `src/game/match-physics-extras.test.ts`, `src/game/online/authoritative-match-session.test.ts`, `src/game/online/matchmaking-policy.test.ts`, `src/lib/moderation.test.ts`.
3. Replay all migrations including 0072 in a fresh PostgreSQL staging instance, then `tests/sql/match_contact_revision_contract.sql`. Verify guest/host authenticated roles cannot change the pinned column.
4. Simulate historical room revision-1 and new revision-2 independently. Verify deterministic score on repeated seeds and equal contract across Web Worker and canonical server; record 1,000+ seed distributions, 10,000 tick no-teleport counters, contact radius, keeper saves and rate of stuck-ball recovery.
5. Abuse/stress in *authorized staging only*: spoofed room/seat, expired/forged tickets, Unicode chat bypass, malformed 8 MiB WebSocket payload, 100 concurrent sockets, disconnect/reconnect, double forfeit, ACK retry and delayed finalization. Count rejections, not player identity.
6. Before enabling 0072 default2 on production, verify the auxiliary path cannot be chosen for 2 and there is sufficient match replay CPU capacity. Test deployment rollback with old room rows and RLS guard.
7. After DO staging is live, replace local presentation with ticked authoritative snapshots. Only then test rank/MRR/competition and new modes.
8. Verify hardware frame-time p50/p95/p99, 1% low, stalls >50ms, context-loss recovery, battery and thermal throttling. Targets are **not** measured proof.

## Threat model and mitigations

| Threat | Mitigation / remaining gate |
|---|---|
| Spoofing identity / seat | Signed, short-lived room tickets; independent transport HMAC verifier still needs staging integration. |
| Room hopping / session replay | Room ID check before connection; nonce and revocation store pending. |
| Tampered score / game clock | Server-only match simulation and signed receipt; client live view still local-only. |
| Command flood / resource exhaustion | 4096-byte frame cap, queue size, per-action quotas, socket backpressure. Add durable per-IP/user admission limits. |
| Double settlement / rewards | Serial finalize/one receipt; end-to-end DB economy and ranking integration pending. |
| Chat harassment / phishing | Server moderation, Unicode normalization, room membership RLS, local mute, report+support. Human appeals pending. |
| DB simulation version tampering | 0072 CHECK and trigger, no browser control; staging RLS/provenance test required. |
| Compromised VPS | VPS gateway remains disabled. No production activation without clean host rebuild and secrets rotation. |

## Release blockers

- GitHub required status checks and main branch protection lack administrator authorization (observed HTTP 403); no merge.
- Exact-head CI has been observed queued without a verified green result. New commit invalidates an older successful run.
- 0072 is **not** recorded as applied in production.
- Physical-device 3D benchmarks, staging DO transport and reconnect testing absent.
- Production PostgreSQL collation and injury refresh maintenance remain separate operator-only issues.

**Status markers:** Files created/updated = code exists; `[x]` delivery requires passing CI and integration evidence. Keep PR #132 Draft and no production deploy.
