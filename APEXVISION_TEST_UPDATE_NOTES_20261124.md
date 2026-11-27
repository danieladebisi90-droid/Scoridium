# ApexVision — Test branch incremental update (Nov 24, 2026)

## Included in this ZIP
- Retains previous GameWeek Safe Update changes (opt-in Edit Mode, 180-degree team change coordinate mirroring, shot-distance feet formatting).
- Self-assist safeguards in stat-first assist mode: exclude shooter's own made markers, reject invalid links, disable same-player jersey when creating a linked made shot.
- For a shot-linking workflow, tapping on/near an eligible existing shot opens a compact choice: link a specific shot, record a new shot at that location, or back. Overlapping eligible markers are presented individually rather than silently choosing the nearest one. Outside shot-linking workflows, usual court gestures are unchanged.

## Not yet implemented / must not be assumed fixed
- Supabase shot edit/delete RPC migration **still must be applied and verified** on staging; no live database changes were made.
- Foul screen restructuring, automatic progression, jersey-first filtering, all-quarter toggle, safer pending-shot transactional flow, unknown-rebound reassignment, OOB event + team rebound linkage, universal shared box score view, and responsive controls remain in scope.
- No database writes or deployed web app changed by creating this ZIP.
- Do not merge to main until game-day functional regression tests pass, especially double-tap MISS and shot-linking popup on phone and iPad.
