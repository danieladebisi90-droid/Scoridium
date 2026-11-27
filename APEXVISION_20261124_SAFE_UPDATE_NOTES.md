# ApexVision — safe incremental update from uploaded ZIP (2026-11-24)

Source: `Scoridium-feature-apexvision-film-room-gamehub-20261117 2.zip`. This is an independent edited copy; no changes were made to a live website or Supabase instance.

## Implemented in this package
- Added explicit **Edit: OFF / Edit: ON** toggle to Combined Tracking toolbar. Court shot-marker clicks open the existing editor **only** when ON; default marker clicks no longer open the editor. Normal single/double-tap tracking remains controlled by the existing court workflow.
- When changing the shooting team in shot editor, transform both X and Y coordinates (`x = 860-x`, `y = 470-y`).
- Show calculated shot distance in **feet, before shot type/result** in Combined Tracking Play-by-Play.
- Show shot distance in the shot location editor.

## Required staging verification
- Existing shot editor Save/Delete calls `apexvision_postgame_edit_shot` and `apexvision_postgame_delete_shot`. The supplied `MIGRATION_APEXVISION_COMBINED_SHOT_EDIT.sql` defines these functions, but **has not been applied** to Supabase by this package. Confirm prerequisite migrations, backups, RLS permissions, parameter signature, and migration safety before running on staging.
- Run end-to-end tests in staging with actual Supabase, especially edit/deletion and halftime markers. Syntax tests are not a substitute.
- Edit ON must not interfere with stat-first linking; Edit OFF must preserve single/double-tap shot gestures.

## Still to implement and test
- Proper pending-shot transactions and Back cancellation; jersey-first and court-first bidirectional selection; overlap popup; quarter-only shot visibility plus All; OOB team rebound and linked PBP; unknown attribution and shot eligibility; streamlined foul inputs; shared review event presentation across all three Film Room modes; consistent responsive action button sizing; cross-device synchronization checks.
- Real-team setup (name, colours, roster, schedule), public read-only mobile page, and secure Supabase RLS. Do **not** enable anonymous data access until RLS and minor privacy are reviewed.

## Release approach
Work in a staging branch/copy. Do not replace the tested game-day build on Friday/Saturday until live-save, role permissions, scoring and refresh tests pass.
