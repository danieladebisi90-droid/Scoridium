# Quick Track visual polish

Built on the verified Quick Track v2 Start Game fix. No changes to event recording, sync, foul logic, or Court mode.

- Start / Resume is yellow.
- Made-shot buttons use deeper saturated green; misses use brighter red.
- Tracked team uses its primary and secondary colors from the `teams` database row (navy/gold fallback).
- Opponent uses neutral slate fallback because opponents may not have colors.
- Subtle scoreboard and panel accents without gradients or glowing borders.
- Removed the duplicate TEAM tile from idle player grid. Top-right TEAM shortcut remains.
- Layout dimensions, action sequence, and responsive modes are unchanged.

Test in browser and on mobile, particularly 12+ player rosters, foul flows, device sync, and whether team colors load correctly.
