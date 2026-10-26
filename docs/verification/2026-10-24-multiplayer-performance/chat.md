# Room-chat trust boundary and rollout

The former `room-chat-*` channel was public Broadcast. Its receiver accepted an arbitrary browser-supplied `from` and cast `text` straight into the React renderer. This allowed sender impersonation and malformed object-shaped text capable of breaking the view. React escaping by itself does not authenticate a sender or make arbitrary objects renderable.

The replacement uses `match_room_messages` rows with authenticated participant RLS and MFA policy checks. Browser INSERT grants cover only `room_id` and `body`: UUID, sender and creation timestamp are database defaults. UPDATE/DELETE are not granted. A private trigger serializes writes with transaction advisory locks, enforcing ten messages per user per minute and 200 messages per room. Both lookup/rate query paths are indexed. Browser code validates rows, ignores unknown fields, deduplicates and orders reconnect history, and retains only forty visible messages. Live chat can be toggled in the stadium; after completion it is read-only. It never grants match results, achievements or rewards.

## Direct evidence

- 41 focused tests across six files passed after the chat/parser and settlement changes.
- Fourteen access checks executed against a local PostgreSQL WASM runtime covered sender/timestamp spoofing, oversized body, rewriting/deletion, outsider/anonymous reads and writes, MFA denial, rate limits and closed rooms.
- The committed SQL contract executed successfully against the existing Supabase PR #62 preview `bnvzuxdnvixsbrrkoden`. It covered real RLS/grants, host and guest reads, sender-spoof rejection, outsider/anonymous access, rate limit and the 200-message room cap.
- The preview verification created schema and fixtures inside one transaction and rolled everything back. A follow-up query confirmed the message table was absent and auth.users was still empty. No production data changed.
- Migration history validation passed. TypeScript, focused zero-warning ESLint and the production build passed in the session; final CI must cover the final commit.

## Deployment

Apply `20261024232316_multiplayer_room_chat.sql` before publishing the client. The table starts empty. The old public Broadcast transport is not used by the replacement client; older clients can continue using it until they reload, so this patch is not a claim that old deployed clients are already secured. The schema is additive and no legacy room or message is rewritten. Retain the table when reverting the client; deleting it would delete private message history. Message history is available only to the room's participants and is deleted if its room/account is deleted.

The SQL access contract is part of the disposable database replay workflow. Preview database checks do not prove WebSocket delivery, two-browser UX or performance at production scale. Those remain release checks. The multiplayer presentation is still client-simulated while final outcomes come from the private-seeded server replay; this change does not turn it into continuously authoritative tactical multiplayer.
