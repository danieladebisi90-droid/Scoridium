# Scoridium — Quick Tracker Integration (Phase 1)

This builds on the uploaded project, **not** a new empty app. The original court, tip-off setup, game controls, Supabase write queue, game events, unassigned list and play-by-play have been retained.

## Files added
- `quick-track.js`: roster → stat → linked assist/rebound workflow, team quick scoring, and opponent team controls
- `quick-track.css`: responsive quick-input styling

## Files changed
- `game.html`: Quick Track panel and new assets, with original player/stat panels preserved
- `script.js`: skip drawing court markers for shots that have no location; explicitly label team rebounds; exclude linked/explicit team events from the player-assignment queue

## Use
1. Make a separate backup of your current app. Replace it with the contents of this folder for testing.
2. Launch with VS Code Live Server or HTTPS. Open Game Hub, enter a test game, and confirm tip-off.
3. The new Quick Track panel appears in the right column on tablet/desktop or in the normal document flow in phone portrait. Tap #8 → 2PT MADE → #12. Check score, play-by-play and stats. Tap #8 → 2PT MISS → OUR TEAM → #12 to record a rebound. Test Team +2 with no player, opponent +3, opponent 2PT miss → rebound, and opponent PF.
4. 'Court controls' switches to the original player/stat controls. The full court still renders in the left section; you can also use it to record located shots.
5. On narrow **phone landscape**, the original three-column court view currently remains the supported UI. The new Quick Track screen needs a dedicated mobile-landscape layout before replacing it there.
6. Test from a second device and after refresh to ensure all events appear. Do not finalize a real game until sync is verified.

## Important limitations / not done yet
- This is the **first functional integration**, not the finished new UI or recorded-review system.
- Shot events can have `x/y = null`. They contribute to scores and makes/attempts but must not appear as fictitious markers at (0,0).
- Assists, rebounds, and confirmed no-assist decisions are represented as separate **linked** events. The current play-by-play hides linked event rows; we still need to enhance its summaries and editing for review mode.
- `team_offensive_rebound` and `team_defensive_rebound` types preserve explicit team rebounds, but existing box-score/analytics aggregation needs to be updated to include them in *team* rebound totals, without counting them as player rebounds.
- Quick opponent REB defaults to defensive; use the missed-shot follow-up for correct offensive/defensive identification.
- Recorded-review footage, shot-location assignment, roles for multiple trackers, and full analytics validation are later phases.
- No database migration was performed. If your Supabase `game_events.type` field has an enum/check constraint, the new types `no_assist`, `team_offensive_rebound`, and `team_defensive_rebound` must be supported before testing those actions; otherwise the existing sync failure/recovery path will report failure. Test on a nonproduction game first.
- No live browser/Supabase integration test was possible in this environment. JavaScript syntax checks passed; functional verification remains essential.
