# Film Room Stat Tracking: first phone-first responsive rebuild

- A single Stat Tracking UI now uses the **existing phone Quick Track markup** at every viewport width.
- The same interactive phone-style review page and page dots are available in every orientation.
- Portrait places Tracked Team above Opponent; landscape places them side by side.
- Buttons, headings, and spacing scale using CSS `clamp()`; short landscape screens can scroll.
- Removed `postgame-ipad-stats.js` and `postgame-ipad-stat-landscape.js` and their script tags.
- Removed their two CSS sections from the existing consolidated `postgame-responsive.css`.
- No changes to Shot Tracking or Combined Tracking JavaScript.
- NOTE: This rebuild does **not** fix any pre-existing roster/Supabase data-loading issue.
- Validation: JavaScript syntax and local HTML asset references checked. Live browser gameplay, touch layout, and database saves not verified.
- The consolidated CSS still carries earlier historical rules outside these removed stat-specific sections. Later cleanup should follow actual device testing.

## Test
Open `postgame-track.html?mode=stat&gameId=YOUR_GAME_ID` in your local server. In Chrome DevTools, test iPhone portrait/landscape and iPad portrait/landscape. Check page dots, team selection, stat action, saved event refresh, then other modes for regressions.
