# Fix the store, payments, career and football data; add AI to matches and a new voice

## What the check found
- The connected database is the right one. It holds the 1.79 million matches, 24,327 clubs and 8 players' accounts. No reconnection is needed.
- The problem: 71 setup steps added since September 12 were never applied to it. The store, refunds, cloud career saves, club venues and the football import all depend on them. That is why the 8 files failed.
- The preview only builds because the checks were loosened as a stopgap. That stopgap will be removed.
- Players already sign in through this project's built-in login (email, Google, Apple, Microsoft, Lovable). Nothing new is added. Login will be checked end to end.

## Steps
1. **Apply the missing setup.** Apply the 71 steps in order, exactly as written. If one fails because something already exists, skip just that step and report it. Then refresh the database description the code reads.
2. **Remove the stopgap.** Restore strict checks in the 8 files and fix any real mistakes they show:
   - `fulfillment.server.ts`
   - `purchases.functions.ts`
   - `payments.functions.ts`
   - `player-career.functions.ts`
   - `football.functions.ts`
   - `real-football.functions.ts`
   - `club-database.functions.ts`
   - `apifootball-import.server.ts`
3. **Check every area** and fix what fails:
   - Sign-in: email, Google, Lovable.
   - A test store purchase in test mode, including delivery to the wallet.
   - Saving a career to the cloud.
   - A 3D match on desktop and on a phone-sized screen: ball physics, players, camera.
   - The match screen.
4. **AI coach, players and crowd.** Uses the newest GPT model, server-side only, billed to project credits.
   - **Tactics:** the AI coach picks the formation, intensity and substitutions at kickoff, halftime and after goals. Each choice is saved with the match, so the same match always replays the same way. Multiplayer scores and achievements stay verifiable.
   - **Talk:** coach team talks, player reactions (celebrations, complaints) and crowd chants, all in Portuguese.
   - **Fallback:** if the AI is slow or fails, the current rule-based coach decides, so the match never stalls.
5. **Realistic voice.** Narration switches to the OpenAI realistic voice. ElevenLabs stays connected as a backup if the new voice fails.
6. **Accessibility review** of the match screen, store and sign-in pages, fixing problems from most to least serious:
   - Buttons without names.
   - Inputs without labels.
   - Tap targets that are too small.
   - Live score updates that screen readers don't announce.
7. **Tests.** Add tests for:
   - A purchase delivering exactly once.
   - AI tactics replaying the same way.
   - Falling back when the AI fails.

## Notes
- Step 1 changes the live database that the published site also uses. It only adds things; no data is deleted.
- "ChatGPT 6.1 Terra" does not exist. The newest available GPT model is used.
- The AI only chooses tactics. Ball physics and how plays resolve stay rule-based, so mid-range phones keep smooth frame rates.
- Code quality: the security results come from the last scan. A fresh scan from the Security tab is recommended after step 2.
