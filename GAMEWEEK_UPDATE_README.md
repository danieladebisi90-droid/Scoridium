# ApexVision — Combined Tracking Game-Week Update

Source: **ApexVision_Combined_Shooter_Selection_Fix_2026-11-22.zip** (latest prior test snapshot). Original files were not changed.

## Changes implemented in this staging package

- Preserve the approved **court-left / Falcons-above-Wildcats-right** tracking workspace and two swipe pages.
- Remove the redundant Team Mode control from the top toolbar and allow the workspace to use the freed area.
- Game Details: Box Score and Play-by-Play are side by side on wider screens, individually scrollable; related events display inline in parentheses, with narrow-screen fallback.
- Player-first AST/REB/BLK: tap existing eligible highlighted shot markers or an empty court location to create a related attempt; automatically classify OREB/DREB from team ownership. Tracked-team new shots request shooter selection.
- Shooting fouls: select a shot on the court instead of Already Recorded/Record Now; preserve free throw calculation. New shot is created only when tapping empty court space.
- Free throws for opponent appear in the opponent container, and opponent made shots offer team-level AST/No AST.
- After missed shots/blocks, rebounds and possession actions are assigned to the correct team containers; a completed block is no longer offered again.
- Out-of-bounds selection no longer mistakenly records a team rebound. **Persistence of an independent out-of-bounds event is NOT implemented** (requires a safe database event type/migration).
- Direct turnover/steal choices have appropriate team placement.
- Technical fouls default to 1 FT; when the selected Falcons player commits it, the player is assigned a foul.
- Shot correction dialog: tap an existing marker to change team/shooter/made/miss or adjust location with a small half-court; deleting a shot is supported by staging RPC. Team change mirrors x across the court.
- Historically recorded marker positions mirror visually when the selected review period crosses halftime. Stored x/y are unchanged.
- Fixed stale scoreboard by dispatching save-completion updates on window, where the scoreboard listens.

## IMPORTANT — Before using this in a real game

1. This build is **not production-tested**. It has passed JS syntax checks and three narrow browser smoke checks using mocked event persistence, NOT real Supabase tests, multi-device concurrency tests, or physical device visual checks.
2. **Never apply the new SQL directly to production without database backup, code review, and staging testing.** The shot editor requires `MIGRATION_APEXVISION_COMBINED_SHOT_EDIT.sql` on a matching staging schema and adequate existing postgame tracking migrations. Without it, Save/Delete will display an error rather than silently pretend to succeed.
3. The editor is restricted to **post-game-created shots**. It deliberately refuses editing historical/live entries. Edits that would leave incompatible linked stats are blocked until those links are resolved; automatic reparenting of all linked stats is not complete.
4. Independent Out-of-bounds events are not saved yet (no rebound is improperly added). Bonus foul classifications and detailed foul metadata need a separately verified migration; not all foul-based rule scenarios can be guaranteed from the existing `game_events` columns.
5. The tests do not assert screenshot-level layout fidelity on phone or iPad, nor Supabase permissions and RLS/migration compatibility.

## Installation

**Option A:** Extract the ZIP into a separate staging folder; preserve your working game-day version as a backup.

**Option B:** Apply the included unified patch from the root of the current source project with `git apply ApexVision_Combined_GameWeek_Update.patch`, after checking `git apply --check`. The patch assumes the same source ZIP identified above.

Test AST/REB/BLK linking, shooting fouls/FT, screen layout, score refresh, shot correction, and Q2→Q3 marker direction in staging. Do NOT use the updated build in a live game until the database integration tests pass.
