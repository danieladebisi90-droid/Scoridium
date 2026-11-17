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
1. `MIGRATION_APEXVISION_POSTGAME_TRACKING.sql` (creates authorized event/shot backfill RPCs and postgame permission check; requires `private.can_track_game(uuid)`, existing games/events/players/tracker_observations schema).
2. `MIGRATION_APEXVISION_FILM_ROOM_STATUS.sql` (depends on the new postgame permission check).
3. `MIGRATION_APEXVISION_SCORE_SNAPSHOTS.sql`.
3. The **existing** `apexvision_submit_game_score` RPC must be installed and authorized before submitting final scores.

The migrations are **not** deployed. The app will show informative errors until they exist.

## Important outstanding work / known limitations
- Post-game Stat Tracking and Shot Tracking now use separate `postgame-track.html` pages (Stat and Shot modes) that do not change the live game state. New events use idempotent UUIDs; existing field-goal attempts can receive locations or corrected player attribution with version checks. The feature is **not production-verified** until migrations and browser tests are completed.
- A live Shot Tracker observation can be matched to an existing unlocated shot, or explicitly promoted as a missing attempt by a transactionally linked RPC. Neither path silently duplicates an existing shot. Confirmed new events affect analytics, not the saved final result.
- No playback/video upload integration, timeline checkpointing, per-user progress, or automated complex possession merging yet. Post-game event creation order reflects time entered, not video/game chronological order.
- Film Analysis itself continues to annotate existing recorded events; it does not ingest game video or create complete shot charts.
- Score popup buttons are available on the previous, next/live, and mobile current-game cards. The legacy `add-score.html` workflow is unchanged.
- Score snapshot creation and existing official-score approval are distinct operations, so a successfully stored final snapshot may still fail to create the pending approval request. In that case the UI reports both outcomes.
- The no-head-to-head fallback currently shows record and scoring averages derived from game records; FG% cannot be shown until the event-level stats query is integrated.
- Existing game records with equal *final* scores are not automatically changed or deleted. Audit those separately before any data normalization.
- Staging behavioral tests, production SQL compatibility checks, viewport visual tests, live multi-device checks and deployment have **not** been performed.

## Review checks
Check migration function dependencies and RLS roles; verify that ordinary team members cannot change Film Room statuses when not tracking-authorized.
Test popup on desktop/mobile, score snapshots for all three point types, reopening timestamp, success/failure branches, and whether a tied final score is rejected.
Confirm calendar highlighting for no-location and multiple-games-on-one-day cases, and confirm next-game empty state in desktop/mobile.
Avoid deploying the branch or migrations to the live site until the above and post-game tracker behavior are verified.

## Static checks performed
- JavaScript syntax checked for Film Room, Post-game Track, score popup, Game Hub and tournament context: passed.
- Compared the post-game shot-value calculator with the existing live tracker `detectShot` over 5,989 FIBA full-court coordinate samples: zero mismatches.
- Checked Game Hub and Film Room navigation, SQL function names and loaded screen assets: passed.
- **No Supabase migrations executed**, no device/browser checks, no score approval tests, and no deployment. These remain mandatory.
