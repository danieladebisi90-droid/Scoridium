# ApexVision — Full test-branch project update (Nov 24, 2026)

**Base:** most recently uploaded `Scoridium-feature-apexvision-film-room-gamehub-20261117 3.zip`.
**Scope:** test-only project copy. No `main` merge, database deployment, or production data change was performed.

## Changes implemented in this archive

1. **Quarter-specific court markers:** `Show shots` view filter (individual quarters or All) independent of the recording quarter. Existing coordinates are displayed in their saved locations, rather than being flipped by the selected quarter. Scores are unaffected by the filter.
2. **Opponent team Box Score:** Team-level PTS, REB, AST, STL, BLK, TO, PF, shooting splits, and foul counts by quarter, underneath the tracked-team player table on Game Details.
3. **Context-aware shot-link prompts:** AST, BLK, REB, and foul links ask the relevant question. Highlighted shot markers and overlapping-shot popup options share temporary individual colours. Each option includes shot distance in feet.
4. **Unknown rebound reassignment:** REB-first eligible highlights include an existing tracked-team rebound with an unknown player. Selecting it calls the existing authenticated `apexvision_postgame_assign_player` RPC, changing that event's player, not adding a second rebound. A rebound credited to a known player or to a team stays ineligible.
5. **Block after a rebound:** Linking BLK to an existing missed shot with a completed rebound preserves that rebound and finishes the block workflow instead of demanding another rebound. Shots with a block remain ineligible for a second block.
6. **Edit Mode nearby shots:** Multiple nearby shots open a colour-matched selection popup before entering the editor; an isolated shot goes straight into the editor. Empty-court clicks no longer record new shots while Edit Mode is active.

## Still required before merging to main

- **Critical: Shot edit/delete Supabase RPCs.** `MIGRATION_APEXVISION_COMBINED_SHOT_EDIT.sql` is included but requires review and application to the correct TEST Supabase project. Do not run SQL on production without validating it. The browser previously reported the edit RPC was absent from the schema cache. Only postgame shots are allowed by the migration.
- **Shooting foul workflow rewrite**, including single/double-tap Select Shot without linking an existing shot, one-time shooter selection, removing Continue/Cancel, auto FT calculation, and non-counting missed foul attempts. The present `game_events` schema counts regular missed shots as FGA, so do not use the old shortcut as proof of correct official FGA accounting.
- **OOB + team rebound:** preserve both the possession result and correct team rebound in Play-by-Play. Existing permitted server event types omit `out_of_bounds`; needs safe database and client changes.
- **Shared Film Room review format across all three modes** and audit of FGA, point totals, FT links, and opponent stats against events.
- Live multi-device synchronization, offline/reconnect, browser/mobile end-to-end testing, and staging RLS authorization verification.
- **Actual team/roster/public viewer site setup:** to happen after reviewed test-branch changes merge into main.

## Verification performed

- `node --check` syntax validation on modified JavaScript files.
- Structural checks of expected modified selectors, event paths and migration file presence.
- **Not performed:** staging Supabase SQL execution, end-to-end functional browser testing, real game consistency audit.

## Test instructions

1. Keep a backup of your existing test branch before replacing files from this ZIP.
2. Open `postgame-track.html` through the normal ApexVision app routes with an existing completed test game.
3. Check **Show shots Q1 / Q3 / All** without creating attempts or changing score.
4. Swipe to Game Details: inspect the tracked team table and opponent team-level table and foul breakdown.
5. Link AST/BLK/REB with overlapping shots: matching marker/popup colours, contextual heading.
6. Verify REB-first known player exclusion and **Unknown Player** reassignment (same team/rebound type; one rebound event in PBP).
7. Enable Edit Mode: isolated marker editor, overlapping popup, empty court no new shot.
8. Do not test Save/Delete expecting success until the staging migration is correctly applied.

All files are included as a complete source ZIP. Avoid merging into `main` until the unfinished items and regression tests are completed.
