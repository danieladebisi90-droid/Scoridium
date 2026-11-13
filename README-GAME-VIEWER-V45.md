# Scoridium V45 — Read-only Game Center

This update builds on V44.1 and replaces the minimal `watch-game.html` with a responsive read-only game viewer.

## Included
- `watch-game.html`, `watch-game.css`, `watch-game.js` — centered live/final scoreboard (home/away orientation, team colours, current quarter), recorded quarter breakdown, chronological play-by-play (latest first), and team player box-score statistics from game events.
- Supabase Realtime listener on the selected game and its events, with 12-second polling fallback when the page is visible.
- Full human-readable game dates and proper empty/permission states.
- Service-worker cache version bumped to v45 for update detection; no SQL schema changes.

## Usage
Open Game Hub or Dashboard > View Game. Existing links use `watch-game.html?gameId=...`. This page is read-only and does not write to Supabase. It works as a page inside the persistent app shell.

## Requirements and cautions
- Supabase RLS must grant the intended viewers SELECT on `games`, `game_events` and (if showing player names) `teams`/`players`. This release does not relax RLS or add public access.
- Quarter totals are calculated from recorded scoring events and may not match the official final score if event tracking was incomplete. The official score in the main scoreboard comes directly from `games`.
- Player box score counts only recorded attributed events; it does not invent opponent/player data.
- Existing Game Hub and Dashboard links already point to `watch-game.html`.
- Test on iOS Safari/PWA and desktop with live and completed games, and test viewers with different access permissions.
- Do not deploy an untested ZIP over production without keeping a backup and checking regression-sensitive tracking workflows.

## Deployment
Extract this **full project archive** over your working repository and review changed files.
Run `git add . && git commit -m "Scoridium V45: Read-only live game viewer" && git push origin main` when ready.
