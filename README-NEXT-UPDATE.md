# Scoridium — Court + Automatic Comparison Update (source patch)

## Files to replace/add

- `game.html` (replace; retains the prior assist play-by-play script revision)
- `collaboration.js` (replace)
- `collaboration-v2.css` (new; loaded after existing `collaboration.css`)
- `MIGRATION_COLLABORATION_V2.sql` (new database migration, **not** a website file)

All other existing files remain unchanged. This is **not** a complete standalone application. It assumes the prior `scoridium_collaboration_update_patch.zip` and the assist play-by-play fix were installed, including `collaboration.css`, `quick-track.js`, `tracking-layout.js`, and the original calibrated court and `script.js`. If those changes were not installed, first integrate them into your working branch. Back up working files and the Supabase database before overwriting anything.

## Database setup

1. In the same Supabase project, ensure the **original** `MIGRATION_COLLABORATION.sql` was applied successfully.
2. Confirm that `private.can_track_game(uuid)` exists. This is the same membership/game-permission function used by the existing `game_events` SELECT policy.
3. Review and run `MIGRATION_COLLABORATION_V2.sql` in Supabase SQL Editor as an authorized administrator. Committing SQL to Git does not run it. This changes observation/checkpoint permissions to accept game tracking grants as well as coach permissions, adds audited undo of unlinked observations, and makes automatic links atomic.
4. Confirm both signed-in trackers have the correct per-game or per-season tracking permission (or qualifying coach membership) and can read/write `tracker_observations` / `tracker_checkpoints`.
5. Test in a **throwaway game** with two separate accounts and devices before live use.

## Implemented

- Court tap/click = MADE; double tap/double click in roughly the same spot within 340 ms = one MISS. The first tap is deferred until the gesture window ends so a miss never first registers as a make. Old shot queue and manual MADE/MISS location-first controls removed.
- Court event observations are independent: they never directly change official score or field-goal attempts. Unmatched provisional markers appear as dashed rings; saved official shot markers remain unchanged.
- Automatic alignment of shot and observed FT sequences by team, points, result, and order, allowing missing/extra events and filtering out opposition shots in **Tracked team only** mode. Running team-score transitions appear in the side-by-side comparison. Ambiguous/repeated sequences remain for review rather than being guessed. Auto-link requires a unique sequence alignment, synced and versioned official event, time within two minutes, and server RPC acceptance.
- Shot count / matched / pending button opens side-by-side comparison; X closes it. No regular shot queue.
- FT bar inside constant-size container: FT → select team → attempts (1–3) → MAKE/MISS each → Done.
- Both users enter **physical venue** home/away scoreboard values at quarter-end; not in the live Court view. Reporter submissions are kept separately. Primary tracker is prompted before End Quarter; other connected trackers are prompted when the quarter transition arrives via game realtime updates. They may choose Later; the primary cannot advance without first submitting a score under this patch.
- Portrait phone uses half court; FT below court; shot status at top. Landscape allows half/full, hides Offense/Defense in full, keeps labels from existing court logic, and prioritizes maximum undistorted court height with flexible full-width side controls; Switch Sides reduced to an icon button.
- Larger Quick Track button/team text on phone, without changing fixed container sizes or desktop styling.
- Undo retracts your most recent **unmatched** shot observation using the audited v2 RPC. Already-linked locations require review, not deletion. FT Back retracts the last saved attempt where possible.

## Test before production

- Confirm the original FIBA geometry, basket direction changes/halftime labels, 2PT/3PT boundary and distance calculation with current `script.js` on each device.
- Test phone portrait/landscape in Safari and Chrome (tap vs. double tap, and no accidental zoom).
- Test identical streaks, one missing event, one extra event, a wrong make/miss, FT sequences, and tracked-team-only mode. Ambiguous results **should remain unmatched** rather than force-linking.
- Test two authorized accounts (especially non-coach tracking permission), offline/online synchronization, quarter-score submissions, refresh persistence, and automated location linkage. Check SQL migration completion and `game_events` RLS if either user sees no shared shots.
- Observe that the physical scoreboard is **not** automatically read by camera/device; both trackers must manually enter the visible venue numbers at quarter end.

## Honest limitations

- The JavaScript syntax and representative sequence-alignment cases were checked locally. The full source **has not been exercised against your actual Supabase project or two real devices**, and no live-game correctness guarantees are claimed.
- The alignment is deliberately conservative. Similar repeated shots, network delay, FT omissions, or multiple gaps can leave observations pending. The comparison screen shows discrepancies but does not yet provide a full multi-event correction editor. Auto-linking does not create or alter official scoring events.
- The in-game `games` realtime subscription requires the proper Realtime publication/permissions to notify the second tracker about quarter endings; if notifications do not arrive, the tracker may need to reload to trigger current-period reconciliation. Confirm this workflow before real games.
- The updated quick tracker text is responsive and could still need fine adjustments for unusually narrow devices or large accessibility text settings.
