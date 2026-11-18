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

## November 17: Film Analysis and Shot Tracker layout refinement
- **Advanced Film Analysis** uses the existing exact FIBA half-court art at left and event classifications aligned in a detail panel on the right. Each shot marker corresponds to an existing stored x/y coordinate; right-basket shots are mirrored into the standard offensive half court. A missing x/y is explicitly labelled unlocated and no marker is fabricated. An event list, quarter filter and Previous/Next actions select the highlighted shot and its form.
- **Post-game Shot Tracker** is court-first: tapping the court opens the shot-result popup. A separate **Shot Links** dialog contains matching to existing shot attempts, unlinked observations and recorded shot history, rather than filling the main screen with controls. It still uses the existing post-game authorization RPCs.
- These changes only update the GitHub draft branch. **No new SQL migration is needed for the Film Analysis layout changes**, which use existing `game_events` and `apexvision_film_tags`.
- The requested **Option C hybrid post-game Stat Tracker** (full live Quick Track parity, shot-type buttons immediately after each shot, free quarter navigation and chronological insert/reorder controls) remains a separate in-progress workflow and is **not completed in this patch**. Do not imply it is tested or ready for production.
- Film Analysis positions are based on recorded shot coordinates; no video playback, upload, frame synchronization or automatic detection is included. The operator can watch video separately while reviewing the shot map and classification fields.

## Film Room Phase 2 — approved compact 3-mode review (November 17)

### Updated entry modes and shared data
- The compact Film Room home has **Stat Tracking**, **Shot Tracking**, and **Stat & Shot Tracking**. All operate on existing `game_events` for one completed game, regardless of what was recorded live.
- The third mode has **its own database activity key `combined`**; pre-existing `film` activity history remains untouched.
- Each card displays **Last Reviewed**, from an actual post-game save, saved footage timestamp or explicit status review/completion, rather than simply viewing the page. Not Started / In Progress / Completed remain independent. Users may reopen a completed review.
- Stat mode has a full FIBA court and a compact Quick Track-inspired opponent-half action container; a court tap selects the exact 2PT/3PT zone and leads through jersey, make/miss, optional shot creation/pressure, and assist/rebound choices. Opponent/team controls and make/miss FTs are available.
- Shot mode keeps the full court and uses the shot popup and separate **Shot Links** review dialog; it preserves matches to previously recorded attempts.
- The combined mode adds **Stat Tracking** and **Shot Tracking + Analysis** tabs around the same court/game events. Shot analysis uses in-container buttons and stores annotations in `apexvision_film_tags`.
- A previously stat-tracked, unlocated FGA can be matched to a new post-game court selection rather than duplicated, with explicit selection if several candidates exist. Full score remains unchanged under existing post-game RPC protections.
- Recorded shots may be opened in the separate existing advanced half-court classification view for revising saved annotations without creating a shot.
- The Play-by-Play panel allows optional **video MM:SS timestamps**. Known timestamps drive footage order; events without timestamps are ordered by entry time and clearly labelled as such. These timestamps are not game-clock values.

### Additional SQL migrations — staging only
Run these **after the previous three migrations**, in this order, in **ApexVision-Test**:
1. `MIGRATION_APEXVISION_FILM_ROOM_REVIEW_DATES.sql` — independent combined-mode status plus per-mode Last Reviewed.
2. `MIGRATION_APEXVISION_POSTGAME_EVENT_LINKS.sql` — authorized linking of additional postgame assists/rebounds/blocks to an existing same-quarter shot (and controlled supported other links).
3. `MIGRATION_APEXVISION_POSTGAME_TIMELINE.sql` — RLS-protected footage-timestamp metadata for any existing game event.

**Do not run these in production until staging behavior and permissions are verified.** All migration SQL is unexecuted in the assistant environment. An existing `game_events.linked_event_id` and the Film Analysis tag RPC remain prerequisites.

### Known implementation limits / test gates
- The post-game Quick Track control panel reuses the design language and key flows of live Quick Track, **not** its entire original live game-state engine. Advanced technical/special foul detail, automatic linked turnovers for a steal, and full multi-step free-throw sequences still need functional parity verification and refinement. Use the existing manual form for unsupported or complex situations rather than claiming parity.
- The combined workflow currently offers a switch between stat-entry and shot-analysis views sharing one court; on compact screens the stat controls stack under the court instead of overlaying it.
- Postgame footage timestamps are manually entered and do not sync or play video.
- Existing unlocated attempts can be linked, but similar already-located shots still require careful explicit duplication review. Do not auto-merge events without a verified match.
- Shot analysis save is a second operation after the shot event/shot-location RPC; a tag save failure does not roll back an already saved shot. The UI reports the error for later review.
- Review timestamp updates are best-effort metadata; an event can save even if its Last Reviewed update fails. This must be checked in staging.
- **Static checks only** have been completed for the new code. Browser usability, authorization, database triggers, reconciliation, responsiveness and assisted event linking remain unverified. Keep PR draft until tested.
- Local `supabase-config.js` in the development branch may still point to the original project; use a **separate local test copy** with **ApexVision-Test** project URL and publishable key. Never use the service-role secret in frontend code. Do not deploy the branch against production to test.
