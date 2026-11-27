# ApexVision — Game-day stabilization (TEST BRANCH ONLY)

Based on the full `ApexVision-Test (2)(1).zip` supplied by the user. This is a **candidate**, not a tested release or production deployment.

## Before running

1. Extract the entire project into a **new** folder; do not merge files randomly from older patches.
2. Keep the existing live/production site unchanged. Make a backup of your present test directory and database before any SQL migration.
3. In **ApexVision-Test** Supabase only, review and run `MIGRATION_APEXVISION_GAMEDAY_EVENT_EDITS.sql` in SQL Editor. It creates RPCs for event edits/deletes, linked-shot corrections, and a non-FGA designation for missed shooting-foul attempts. **Do not run it in production.**
4. The code assumes that prior post-game foundation, link and shot-edit migrations already succeeded on the *same* Supabase project.
5. Host the extracted project the same way you currently run ApexVision. Hard-refresh the browser.

## Coordinated changes

- Q1–Q4 viewing-quarter selection sets the actual recording quarter (`post-period`) and broadcasts the shot-view refresh. "All" stays display-only. Quarter changes are blocked during an in-progress shot workflow where the tracker reports one.
- Court direction still follows the active quarter; Q3/Q4 are in the opposite half. The selected-quarter Play-by-Play and its All Q4→Q1 order are preserved.
- Game Details Play-by-Play has individual Edit buttons for each visible underlying event, including linked children.
- Non-shot **Film Room** events can have type, team, player, quarter, FT result and source link corrected, or be deleted. Backend RPC authorization, event-ownership checks, version checks, link-validation and official-score preservation remain in place. Existing live-game events cannot be edited through these RPCs.
- Edit Shot shows linked events, can open the linked stat editor, and can change shooting team, player, result, location and quarter. Incompatible linked statistics are only removed with confirmation. Compatible linked events move with an edited quarter, when safe.
- A missed shooting-foul attempt remains visible on the court but is flagged as **non-FGA/non-3PA** in the Film Room Box Score via a post-game record and protected RPC.
- Out-of-bounds choice after a missed shot/last missed FT records an appropriate linked **team rebound** instead of another player's rebound.
- Shot deletion and existing official live-game scores are left as before.

## Required game-day testing (in the TEST project, with a completed TEST game)

1. Select Q3 in "Show shots". Check both quarter selectors, Q3 court direction, saved Q3 markers, and Q3 Play-by-Play. Then record and refresh one test shot.
2. Repeat in Q4. Choose **Full Court** to check both halves; Q4 will have zero shots if none were recorded in that quarter.
3. Select "All": markers/events from all quarters, Play-by-Play newest quarter first, recording quarter unchanged.
4. In Game Details, edit an unassigned rebound or assist to a known player. Refresh; verify exactly one stat remains.
5. Open a missed-shot editor; inspect linked rebound/block. Edit the linked player and save. Then test MADE→MISSED / MISSED→MADE on a **test** shot and confirm the cleanup dialog.
6. Test Wildcats PF → Shooting → single-tap MADE and double-tap MISSED; verify appropriate FT sequence and missed shooting-foul attempts not counted as FGA/3PA.
7. Test final missed FT → out-of-bounds → team rebound; confirm only one rebound.
8. Verify the official live final score still differs from the Film Room tracked score as expected.

## Remaining limitations / known risk

- **Not validated against the running Supabase service or the actual browser session.** Static JavaScript syntax checks pass, but SQL, RLS, live-game workflows and mobile gestures require real-world testing.
- If shots were recorded in the *wrong quarter* before the synchronization fix, switching filters will not move historical data automatically. Use Edit Shot to correct their quarter. In half-court view, shots saved on the other half remain outside the visible viewport; use Full Court to inspect them.
- Some advanced event-link relationships or historical live-game events are intentionally protected from edits until their dependencies are resolved. The generic editor covers supported Film Room event types, not arbitrary database records.
- Free-throw FGA exclusions are implemented in Film Room views that use `apexPostgame.getEvents()`. Other stat exports not consuming this event source may need separate updates.
- The out-of-bounds selection stores a linked team rebound. A separate explicit Out-of-Bounds event record and wording in all exports are **not yet implemented**.
- This does **not** certify a production live-game launch. Keep a manual backup scoring method available for the first game.

## Rollback

Revert to the untouched copy of your original `ApexVision-Test (2)(1).zip`. Do not apply any database rollback in production. The new migration adds functions and a small event-tag table; do not delete stored records casually.
