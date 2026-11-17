# ApexVision Game Hub + Film Room update (November 17, 2026)

## Branch implementation
- Added a Film Room hub page with three independent activity cards: Stat Tracking, Shot Tracking, Film Analysis. Each has Not Started (absence of a record), In Progress, and Completed states, manually marked complete. No overall progress bar or multi-tracker checkpoints.
- Replaced Game Hub Film Analysis navigation with Film Room.
- Added an in-page Submit Score dialog with quarter-end, game-end, and random during-game snapshots. No game clock. Includes a last successful submission timestamp. Game-end entries also attempt to request official approval through the existing RPC; they do NOT directly finalize games.
- Changed missing-head-to-head fallback to display only the tracked team's season W–L record, PPG and opponent PPG.
- Added calendar markers for any scheduled/live/completed game date, including games with unknown home/away venue.
- Changed top-left shared team title to team secondary colour.
- Compact Next Game empty state, removing the false opponent/TBD matchup.
- Removed unused head-to-head draw computation; completed game scores with no winner are excluded from the new season fallback.

## Required migrations: staging first
1. `MIGRATION_APEXVISION_FILM_ROOM_STATUS.sql` (requires `private.can_track_game(uuid)` and existing tracking permission schema).
2. `MIGRATION_APEXVISION_SCORE_SNAPSHOTS.sql`.
3. The **existing** `apexvision_submit_game_score` RPC must be installed and authorized before submitting final scores.

The migrations are **not** deployed. The app will show informative errors until they exist.

## Important outstanding work / known limitations
- Post-game Stat Tracking and Shot Tracking are NOT yet validated as end-to-end backfill workflows. Film Room currently routes them to the existing tracker modes, and **those modes may still enforce live-game restrictions**. Do not represent post-game event creation or shot matching as complete.
- Stat and Shot Tracking may share the current game tracking page and persistent role selection; the recorded events must be verified for duplicate prevention before release.
- Film Analysis itself continues to annotate existing recorded events; it does not ingest game video or create complete shot charts.
- Only the previous completed game's score button opens the new popup. Other game-selection contexts and the legacy `add-score.html` page remain unchanged.
- Score snapshot creation and existing official-score approval are distinct operations, so a successfully stored final snapshot may still fail to create the pending approval request. In that case the UI reports both outcomes.
- The no-head-to-head fallback currently shows record and scoring averages derived from game records; FG% cannot be shown until the event-level stats query is integrated.
- Existing game records with equal *final* scores are not automatically changed or deleted. Audit those separately before any data normalization.
- Staging behavioral tests, production SQL compatibility checks, viewport visual tests, live multi-device checks and deployment have **not** been performed.

## Review checks
Check migration function dependencies and RLS roles; verify that ordinary team members cannot change Film Room statuses when not tracking-authorized.
Test popup on desktop/mobile, score snapshots for all three point types, reopening timestamp, success/failure branches, and whether a tied final score is rejected.
Confirm calendar highlighting for no-location and multiple-games-on-one-day cases, and confirm next-game empty state in desktop/mobile.
Avoid deploying the branch or migrations to the live site until the above and post-game tracker behavior are verified.
