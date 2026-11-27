# ApexVision Combined Tracking — staged update (26 November 2026)

## Important: test build, not deployed

This is a copy of the user-uploaded `ApexVision-Test (2)(2).zip` project, with targeted updates. The original uploaded archive, Git history, local integration folder, and Supabase database were **not** modified.

**Apply the SQL migrations to the disposable/staging Supabase project before using the new fouling, out-of-bounds, and cascade-delete workflows.** Keep an additional backup. Do not run the new SQL against production until staging gameplay and permission checks pass.

## Files changed

- `postgame-track.js`: shot markers use team colours (filled=made, open=missed), hide missed shooting-foul markers, court marker contrast halo, generate opponent accent from tracked primary colour, use secondary tracked highlight with primary fallback, retrieve foul/OOB metadata.
- `postgame-live-quick.js`: rename Unknown Stats selector, record explicit foul classification/shot association and OOB metadata during staged postgame writes.
- `combined-tracking-responsive.css`: expanded contextual action buttons when space permits, team-colour active container borders, selected action highlights and contrast fallback.
- `combined-navigation.js`: team-foul counts below each respective Box Score; classification and linked shooting-foul/FT/OOB/team-rebound Play-by-Play presentation; reorder plays within their original quarter, including from All view.
- `postgame-event-editor.js` and `postgame-combined-shot-editor.js`: list all known linked dependents and ask confirmation, then invoke the new atomic branch-delete RPC. A dependent deletion must not delete an unrelated parent.

## SQL migrations — apply in this exact order in staging

1. Existing project's `MIGRATION_APEXVISION_PBP_REVIEW.sql` if it has not yet been installed. Required for drag ordering.
2. **NEW** `MIGRATION_APEXVISION_FOUL_DETAILS.sql` — classification for new foul entries, shooting-foul shot association, and explicit OOB metadata on team rebounds.
3. **NEW** `MIGRATION_APEXVISION_SAFE_BRANCH_DELETE.sql` — authorized recursive deletion with version checking, Film Room ownership checks, and official final score invariants. Depends on the preceding migration.

The new RPCs preserve post-game event rows, but their recorded source snapshots can differ from older already-saved events. Historical fouls without classification metadata display `Foul (classification unavailable)` rather than an invented category.

## QA required

1. Refresh the site with cache disabled and verify the new HTML/CSS/JS are loaded. On a blank completed test game, create made/missed shots for both teams and check filled/open marker shapes and colours.
2. Select a quarter, reorder PBP entries by dragging; reload and verify persistence. Also test from All view. Note: reordering cannot move plays between quarters. The existing SQL only accepts Film Room-owned rows.
3. Record shooting foul + missed field goal + two free throws + final FT rebound. Check no missed-foul court marker and no extra FGA. Confirm combined PBP and correct scores.
4. Record shooting foul + made field goal (And-One) and one FT. Check PBP, Box Score, and markers.
5. Record offensive foul with linked turnover, nonshooting foul, technical foul, and missed shot + out-of-bounds team rebound. Verify classifications and linked PBP rows.
6. Delete a shooting-foul play and confirm the warning lists shot, foul, FTs, and relevant rebounds. Confirm each statistic changes exactly once. Cancel the deletion and verify no changes. Also test deleting only an assist (parent made basket must remain).
7. Check white/black/red tracked team colours, actual secondary colour and absent/white-secondary fallback, both active container borders, and mobile sizing.
8. Verify team fouls below **both** Box Scores for all quarters.
9. Complete a short four-quarter simulation and compare independently logged events and final Box Scores.

## Known limitations and deferred work

- No authenticated browser or Supabase staging runtime test was available in this build environment. JavaScript syntax and local asset references were checked; **SQL has not been applied**.
- Current Film Room route still requires `games.status = 'completed'`. The stricter future-date completion safeguard, accidental completion recovery, and server-side live/film concurrency lock are not implemented here; preserve the existing test game's access until there is a tested recovery path.
- Live Stat ↔ Combined reconciliation remains deferred as requested.
- Old foul event records cannot retrospectively infer shooting/nonshooting/technical/offensive class without new metadata or manual review.
- A future test may reveal more than one currently loaded stylesheet overrides sizing or border styles at specific viewport sizes; validate phone/iPad/desktop before deployment.
- If the current database has other newer SQL objects than those in this ZIP, compare function signatures before applying migrations.

## Rollback

Keep the original project ZIP and database backup. If visual or JS behaviour breaks, restore the original source files. **Do not rely on restoring files alone to undo SQL changes**; database migrations need a deliberate rollback plan or a disposable test database.
