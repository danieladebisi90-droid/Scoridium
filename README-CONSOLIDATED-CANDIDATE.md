# Scoridium Combined Release Candidate — 2026-11-13

This ONE source bundle contains the earlier **uninstalled Tournament / Game Hub milestone**, the existing collaborative tracking code and migration files, and the updates implemented during this consolidation.

## Implemented or incorporated in this bundle

- Games calendar selection / Next Game separation / contextual tournament and same-season Head-to-Head from the prior tournament milestone.
- Optional-name date-range tournaments, tentative matches, external result entry, expandable tournament preview, team-secondary-color calendar highlights. Requires `MIGRATION_TOURNAMENTS.sql`.
- Four-destination mobile nav (Home, Games, Roster, Stats), translucent navy treatment, animated active indicator, desktop brand label, Playbook hidden in the shared navigation.
- Viewport safe-area and standalone iOS status-bar configuration on page headers. Exact appearance depends on device/OS; install test required.
- Consistent Inter-first system font stack, larger mobile Quick Track labels, no remote font download required (Inter may not be installed, so system fonts are used).
- Quick Track Team Mode: game events can be entered with `playerId=null`; existing team summary remains based on events. Default opponent six buttons arranged +2/+3/TO over misses/PF; contextual rebound/block controls appear during linked workflows.
- Recovery of missing tracking files (`quick-track.js`, CSS, `tracking-layout.js`, `independent-tracker.js`) from earlier integrated patches. The source baseline was incomplete; compare with your deployed code before using.
- Roster-only armhole and collar jersey trims now use `--team-secondary`; school subtitle and Team Information UI removed; staff counts shown by assigned role; authorized Roster Edit form with soft removal to preserve historical events. Requires `MIGRATION_ROSTER_EDITOR.sql`.
- Dashboard Team Leaders removed; weekly schedule given full row width.
- Player profile team-letter ornament removed, secondary-colored header; contrasting text adapts to theme variable.
- Same-season Opponent Stats tab: available head-to-head game results, recorded shot profile, points trend comparison and available aggregates from completed games. Unknown opponent statistics are marked incomplete.
- Court portrait rules: phones default half-court, portrait iPads can select full court, rotation reflow and shot-marker refresh paths improved. **Not verified on real iPhone/iPad.**

## NOT completed — do not treat as production-ready

1. Guest sign-in via verified email/SMS and secure invite delivery; Supabase Auth/provider credentials, OTP flows, token redemption, self-assigned Stat/Shot Tracker claims, and tournament/multiple-game invitation permissions. Existing `game_tracking_permissions` remains the authority; do not manually give public access.
2. Finished tracking-room roster and privacy controls, server-enforced 1 or 2 shot tracker slots, and self-service handoffs.
3. Independent viewer-relative court rotation while preserving absolute physical basket coordinates.
4. True cross-page performance audit/optimization and font asset hosting. The four-tab shell uses existing iframe navigation; it does not eliminate all reload costs.
5. Complete end-to-end full-game and 2-device synchronization testing, particularly the repeatedly reported disappearing-court bug. A browser smoke test was attempted, but the local Chrome environment blocked localhost navigation.
6. Full tournament bracket progression and updates to other future game records from tournament results.
7. All smaller pages/large-screen overflow improvements and precise player shooting preview replacement are not fully verified.

## Safest installation

1. **Do not overwrite your production deploy yet.** Back up your current site and database first. The source was assembled from a prior persistent-shell ZIP and several incrementally created patches, not downloaded from your live repository.
2. Diff this bundle against the exact current deployed branch. Retain any newer custom work. Preserve your existing Supabase configuration and secrets.
3. In a **staging** Supabase project, review migrations in this approximate dependency order (skip migrations already applied, check names/policies first): `MIGRATION_TIPOFF.sql`, `MIGRATION_DIRECTION.sql`, `MIGRATION_COLLABORATION.sql`, `MIGRATION_COLLABORATION_V2.sql`, `MIGRATION_TOURNAMENTS.sql`, `MIGRATION_ROSTER_EDITOR.sql`.
4. Serve over HTTPS. Test authentication, permissions, full-screen tracking, each Court mode and rotation, roster edits, tournament creation, page navigation, and score reconciliation on actual phone and iPad devices.
5. Check console and Supabase logs. Do not apply roster or tournament migrations to production until the staging checks pass.

Suggested commit after integration and review:

`git add . && git commit -m "Integrate Scoridium tournament, tracking, roster and UI release candidate"`

No changes have been made to any live Supabase project, web host, or GitHub repository by this package.
