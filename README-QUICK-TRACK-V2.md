# Scoridium — Quick Track v2 (additive integration)

This release **retains the existing Court view** including tip-off, shot positions, original detailed controls, Play-by-Play/Unassigned view, and Supabase event queue. A new fixed-layout Quick Track mode is shown in the existing Track view, on phone/tablet/desktop. All game actions are still written through `addEvent` / existing event sync; no database migration was applied.

## Interface
- Scoreboard stays at top; tracked team gets the majority of live Quick Track space; opponent has dedicated controls; last-event preview stays in its own fixed-height section.
- On desktop, tracked and opponent panels sit side by side to use the screen better; on smaller screens they stack. Panels do not resize when selecting events.
- Player grid transforms to +2PT/+3PT green, 2PT MISS/3PT MISS red, REB, AST, STL, BLK, PF, TO. FT buttons are NOT present on the normal player grid.
- Track and opponent panels share event follow-up state. Made shots request assist; missed shots route to rebound and optional linked block; turnovers route to steal/no-steal; Skip exits follow-ups.
- Press PF to open one-container type classification: Shooting / Non-shooting / Offensive / Technical. Offensive auto-creates one foul and one player turnover, without steal. Shooting Made creates a made 2/3-point FG and 1 FT; Shooting Miss creates 2 or 3 FTs without a missed field-goal attempt. The one-by-one FT panel records all attempts; last missed live FT routes to rebound selection. Technical FT attempts are dead-ball by default.
- Unassigned tracked-team FTs now appear in the Unassigned view even when linked to a foul.

## How to test
1. Back up your current project and unpack the zip into a separate folder. Serve by localhost HTTPS or Live Server. Sign in and start a **test game** (not a real live game).
2. Test Track ↔ Court ↔ Play-by-play. Verify original court, timing, tip-off, score, and event recovery continue to work.
3. Test `#8 → +2PT → #12 AST`, `Bearspaw 3PT MISS → Croxford BLK → Croxford REB`, `#8 → PF → Offensive`, `Bearspaw PF → Shooting → 3PT → Missed → 3 FTs → last Miss → Croxford REB or opponent REB`.
4. Compare scoreboard/box score/play-by-play/unassigned on two logged-in devices. Refresh and verify the recorded events and linked stats remain correct. Repeat at narrow phone portrait, phone landscape, tablet, and desktop sizes.
5. Confirm no background vertical movement of panels when switching states; scrolling is confined to the inner roster list for larger rosters.

## Known limitations and checks before production
- **Bonus eligibility is manually confirmed** as 0 or 2 FTs under Non-shooting PF. A validated league-specific bonus rules engine has NOT been implemented. This prevents guessing which foul is eligible, or which rules apply.
- **Technical penalty** requires manual 0/1/2 FT selection and whether to charge an individual PF. Player and team technical-foul subtypes and special possession rules still need a dedicated rules configuration.
- A shooting-foul-made FG is credited to the appropriate team but may initially have an **unassigned shooter**. Assign the shooter in review. Existing read/write schema does not persist every foul subtype, and tracking/reviewing unusual rules decisions requires future data-model work.
- Individual foul and free throw events are real Supabase events, but foul-classification selection state is not persisted while the workflow is open. SKIP in a partially completed FT series does not produce fake FT results.
- Unknown rebound is stored as an unassigned player rebound; official team rebound uses a separate team_* rebound type. The current team-aggregate statistics may not include the latter in team rebound counts.
- Independent AST/BLK controls are available; if used without an associated primary event they may require review matching. The old global Undo still needs linked-play-aware redesign for multi-event flows.
- Test Supabase type constraints for `no_assist`, `team_offensive_rebound`, `team_defensive_rebound`, as on v1. Failed writes should be handled through the existing recovery queue.
- This work has passed static JavaScript syntax checks but **has not been authenticated against a real Supabase account or tested in a live browser session**.
