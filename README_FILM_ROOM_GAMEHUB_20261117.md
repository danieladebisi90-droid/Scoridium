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

## Film Room UX consolidation — latest review (November 17)
- From Game Hub's completed-game card, Film Room now opens in a **compact modal over Game Hub**; Game Hub stays visible beneath the dimmed backdrop. The modal reuses the existing `film-room.html` three-mode chooser in an iframe, preserving independent statuses and Last Reviewed.
- Selecting any mode leaves the picker and opens `postgame-track.html?mode=...` as a **full browser viewport** page, not in the ApexVision shell. The app navigation/header is deliberately omitted. Each review mode can have its own page, per the latest approval.
- Each postgame tracker has a minimal Game Hub back link, compact game details, quarter selector, **Next Quarter** and **End Game** buttons. End Game only **closes review / returns to Game Hub** after confirmation and does not change the official final score or the recorded game's completed status. Next Quarter changes only the selected review quarter.
- **Stat & Shot Tracking uses one continuous full-court Quick Track workflow**, not separate Stat vs Shot Analysis sub-tabs. Optional shot creation and defensive pressure remain built into the Quick Track shot flow.
- Internal event IDs remain stored for correct matching and linking, but are hidden from visible shot selection labels.
- No SQL schema changes were needed in this UX revision. The three additional staging migrations from the previous phase remain prerequisites for review dates, event linking, and footage timeline.
- Latest UX changes are code-only and have **syntax / DOM reference static checks** but have **not undergone manual cross-device browser tests**, particularly the Game Hub modal inside the shared app-shell iframe. Keep this PR draft until staging passes.

## Finalized Film Room v3 layout (approved design; staging implementation)

**Home selector**
- Game Hub stays visible under the compact Film Room modal. The popup has an X, no redundant Back to Game Hub link, and no internal scroll. Three compact cards have status, Last Reviewed and a small shared tracked-score preview.
- Team colors use the selected team's cached color palette, falling back to navy/gold. The official final score remains distinct from the tracked points.
- Selecting a mode opens a dedicated full-screen page. Both **Back to Film Room** and **Finish Review** return to Game Hub with the modal reopened for the selected completed game.
- **Next Quarter** advances the selected review period only. No completed-game state mutation is permitted.

**Stat Tracking**
- Uses `postgame-live-quick.js`, a post-game adapter of the actual `quick-track.js` button layout and branching prompts, rather than `postgame-quick.js` (the earlier simplified prototype, no longer loaded).
- Tracked and opponent team containers replace jersey buttons with stat buttons, then relevant secondary prompts; after completion the interaction resets to jersey selection.
- Original live-only state gating and `addEvent()` persistence are replaced by authorized post-game event RPCs in a sequential write queue. The final score is never overwritten.

**Shot Tracking**
- The full existing FIBA court is the primary workspace. Single click/tap = made shot, double click/tap = missed shot; no Make/Miss prompt.
- Court click selects offensive team based on the basket side and quarter, with manual Switch Directions override.
- The opposite half displays a contextual prompt: jersey-number buttons, then shot-category buttons. After save, the prompt disappears and the court resets. No persistent sidebars or extra post-shot statistical prompts.
- When an unlocated matching attempt already exists, the user must explicitly link it or confirm that a different attempt is being entered. Event IDs remain internal.
- Opponent jersey selection stores an integer on the related shot in `apexvision_postgame_opponent_jerseys` (new staging migration below).

**Stat & Shot Tracking**
- Uses the same court beside two original Quick Tracker-style team containers (responsive stacking on narrow screens), not Stat-vs-Shot sub-tabs.
- Either the court or a team stat can start a play. Court first highlights the relevant team's jersey container. Selecting a jersey replaces jersey buttons with stats in that same team container. The selected/active team container receives a gold outline.
- Stat first: an entered shot highlights the court so a later location can be added to the original shot ID, not entered as another attempt. An assist recorded before a made shot can be explicitly linked to that shot.
- A play proceeds through the existing Quick Tracker's applicable secondary prompts, then resets. Realtime changes and saves update the common tracked score in all three rooms.
- The scoreboard sums saved made FGs/FTs for both teams and shows the immutable official final score separately, including an explanatory mismatch hover. Supabase Realtime plus refresh on focus and periodic polling provide cross-room updates.

**Additional ApexVision-Test migration (not applied automatically)**

Run **`MIGRATION_APEXVISION_POSTGAME_OPPONENT_JERSEYS.sql`** ONLY in `ApexVision-Test`, after the six migrations already applied. It creates one RLS-protected jersey-attribution row per opponent shot. Without it, opponent shots can save but jersey attribution reports a warning. Never apply to production before staging is verified.

**Manual test gates (not completed in this coding environment)**
1. Game Hub → Film Room opens a single compact non-scrolling popup over Game Hub; X closes it.
2. Open each room in the full browser viewport; Back and Finish Review reopen the same popup.
3. Stat Tracking: verify original jersey→stat→assist/rebound/foul/FT→reset flow for tracked and opponent team.
4. Shot Tracking: single/double click, automatic FIBA points, both team directions, opposite-court prompt, tracked and opponent jersey selection, classification, auto dismiss, existing shot linking.
5. Combined: both court-first and stat-first sequences, assist #0 then shooter #10, linked shot location, active-container highlight, no duplicate FGA.
6. Shared tracked scoreboard after edits in each room, page navigation and a second device; official final unchanged.
7. Phone portrait/landscape overflow, popup sizing, half-court context, safe-area, and asynchronous failure recovery.
8. Authorization/RLS, including test users with no tracking rights and duplicate/partial event rollback behavior.

**Known limitations still to verify/refine:** The post-game adapter reuses the original live workflow visuals and decision branches, but the backfill/RPC persistence is fundamentally different from live tracking. Real browser verification is required, especially for opponent jersey saves, assist-first linking, compound foul/FT scenarios, and unreliable connectivity. The prior `postgame-quick.js` and `film-analysis.html` remain in the draft for compatibility but are not primary Film Room modes. Keep this PR draft.

## Film Room v5 — consolidated responsive layout, guided tracking, deferred matching

- New stylesheet `postgame-layout-v5.css` provides a compact team-primary-colored title/back header, a large tracked scoreboard, one quarter/review toolbar, and expansive responsive workspaces. The original Quick Tracker and exact FIBA SVG are reused, not replaced.
- On narrow portrait devices, the real court SVG uses its existing coordinates with a half-court `viewBox`. `Show Opponent Half` swaps halves; switching direction or advancing quarters preserves the existing coordinate model. Court-first and stat-first combined tracking remain available.
- Shot Tracking now has **Free Tracking** and **Guided Tracking**. Guided follows original shot `game_events` IDs by quarter, optionally using existing per-event video timestamps from `apexvision_postgame_timeline`; otherwise entry time is only an approximate order and this is disclosed in the UI. The active shooting half is highlighted and half-court focus follows it automatically.
- In Guided mode, tapping a location updates the selected existing shot event using the authorized `apexvision_postgame_assign_shot` RPC. Missing shooter info uses the existing jersey container; the shot category prompt remains optional. Saved shots advance to the next unresolved event, with Previous, Next and Skip controls. It does not create another shot attempt or score.
- Free Tracking attempts one safe automatic match only when there is a unique unlocated candidate with the same actual player ID, period/team/make/value. Multiple candidates or location-near-duplicate are **deferred**, not forced into a blocking shot-link prompt.
- `postgame-guided.js` provides the Unmatched Shots review dialog: link to existing unlocated attempt, explicitly confirm new attempt, or discard the pending observation. No action is forced on quarter change or Finish Review.
- **Required additional ApexVision-Test migration:** `MIGRATION_APEXVISION_POSTGAME_PENDING_SHOTS.sql` (RLS-protected `apexvision_postgame_pending_shots` table). Without the migration, ambiguous Free Tracking shots fail safely with a warning and do not add a duplicate event. The earlier `MIGRATION_APEXVISION_POSTGAME_OPPONENT_JERSEYS.sql` may also still require staging application.
- Pending observations are not game events, cannot contribute to shot counts or score, and persist across devices after the staging migration is applied.
- **Still not verified in browser/Supabase:** permissions, migration application, end-to-end shot linking/auto-advance, multiple shots entered out of sequence, simultaneous trackers, tablet portrait and phone landscape, screen rotation and intermittent connections. Keep the pull request draft and do not merge until acceptance tests pass.

## Film Room v6 — iPad landscape refinement (Nov 18, 2026)

- `postgame-layout-v6.css` centralizes titles, improves tracked-team panel width, separates quarter actions, removes the redundant Quick Track heading in Stat Tracking, and keeps Stat Tracking / Shot Tracking within the landscape iPad viewport (panels may scroll internally when their contents overflow). This remains unverified visually.
- The quarter selector no longer has a visible "Quarter" caption; its accessible label remains intact. Review utilities remain grouped to the left.
- Shot Tracking uses a dedicated sidebar and larger FIBA court. Full/Half Court toggles are available. Guided Tracking defaults to the half court and auto-follows the shooter between the tracked and opposing halves; manual Switch Directions remains supported.
- Guided current-play display shows the team, shot result, and cumulative game score through the selected play; progress is secondary. When event entry time is not true play time, the interface warns that order is approximate.
- `+ Record a Shot` opens a missing-attempt prompt for either team, a made/missed 2PT or 3PT, then uses the existing court jersey/category workflow. Potential duplicates stay in pending review rather than counting automatically. User may cancel the insertion before or during location selection.
- Successful inserted attempts can be placed before the guided play active when insertion started. **New additional ApexVision-Test-only migration:** `MIGRATION_APEXVISION_POSTGAME_SHOT_INSERTS.sql` persists this ordering across sessions; without it the shot can still be saved but its place in Guided Tracking will not persist.
- TEAM STAT enters team-stat controls; opponent controls remain usable, and a team rebound records a `team_defensive_rebound` (or team rebound in the appropriate linked flow), not a player rebound.
- Never merge this draft into main without landscape tablet browser verification, real touch tests, duplicate-shot reconciliation, staging migrations, and Supabase RLS tests.
