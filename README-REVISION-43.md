# Scoridium Release Revision V2 — 43-change code package

This is a consolidated source-code revision built from `scoridium_combined_release_candidate_2026-11-13.zip` (including the earlier tournament milestone). It has not been merged with or tested against an independently verified copy of the live GitHub branch. Back up the repository before replacing anything.

## Scope: implementation status for the 43 requested changes

1. Lower bottom navigation: **code updated** (`revision43.css`).
2. Better Home/Games/Roster/Stats icons: **code updated** (inline SVG in `app.html`).
3. Translucent floating bar with scrolling content behind: **code updated**; browser backdrop blur fallback is semi-transparent.
4. One Inter font across all pages: **code updated** with Google Fonts + system fallback; external font loading depends on connectivity.
5. Faster page loading: **partial** — persistent shell kept, static JS/CSS asset caching added, no measured full-site speed audit.
6. Hide iPad news ticker: **CSS updated**; test on specific iPad sizes.
7. Tournament creation belongs in Manage Schedule, not opponent panel: **code updated**.
8. Tournament as event type in Manage Schedule: **code updated** (existing type reused).
9. Optional name, dates, optional planned games directly below end date: **code updated**; planned TBD matches stored as tournament matches.
10. Context panel without fixed opponent heading: **code updated**.
11. Default contextual comparison uses most recent completed game: **code updated**.
12. Simple team Head-to-Head bars (wins, PTS, REB, AST, STL, BLK, TO, PF), no player stats: **code updated**. Scores/record from completed game rows; other stats depend on event availability.
13. Remove Active/Staff overview tiles: **code updated**.
14. Full-width Roster/Staff tabs: **CSS updated**.
15. No edit beside every jersey: **code updated**.
16. Only top-right Edit Roster: **code updated**.
17. Edit Roster opens player list: **code updated**.
18. Select player, edit or archive: **code updated**, uses existing roster RPC.
19. Add Player inside manager: **code updated**.
20. Opponent Stats default All Opponents: **code updated**.
21. Filter to one opponent: **code updated**.
22. All meetings or individual meeting filter: **code updated**.
23. Selected-game/aggregate shot data stays appropriately scoped: **code updated**.
24. Full Court, Offensive Zones, Defensive Zones in a SINGLE HORIZONTAL row: **code updated**, retaining FIBA court rendering helpers.
25. Player shooting-zone preview uses existing real half-court component, with visibility CSS: **existing feature retained / CSS updated**; verify in browser.
26. Tracked team scoreboard restores primary fill + secondary top trim: **code updated** (sets `data-tracked-side` from location).
27. Rename user-facing Independent Stat Tracker to Shot Tracker: **code updated**; internal database identifiers retain compatibility.
28. Shot Tracker may use Quick Track independently; Stat Tracker cannot create court observations in UI: **partially implemented**. Existing separate observation stream used; strict *server-enforced* role-specific permission policy requires further security work.
29. Avoid duplicated official scoring from Shot Tracker Quick Track: **existing independent event stream retained**; integration test mandatory.
30. Return to active tracking: **code updated** with conditional Resume Tracking from Game Hub.
31. View-only routing for users without recognized tracking grants: **code updated** in game cards; depends on Supabase RLS. Do NOT treat the client checks as authorization.
32. Read-only game view: **basic functional scaffold added** (`watch-game.html`), full viewer design remains pending.
33. Live dashboard Recent Games replacement: **code updated**.
34. View Game button: **code updated**.
35. On mobile, live scoreboard replaces Next Team Event: **code updated**.
36. Player GP/MIN/PTS arrows rather than emojis: **source checked**, player source had no emoji characters; no guessed indicator redesign.
37. Restore blue player overview: **CSS updated**.
38. Jersey neck and arm trim in secondary color: **code updated** in player profile; roster jersey already uses secondary trim.
39. Secondary-color active profile tabs: **CSS updated**.
40. Universal Inter type on player profile: **code updated**.
41. Tablet news ticker hidden: **CSS updated** (same as #6).
42. Dashboard View All Games horizontal: **CSS updated**.
43. Mobile responsiveness/performance: **partial**; JS/CSS static caching and lower redraw cost in Court markers. Needs measured device tests.

## Mandatory cautions

- This is a **release candidate, not a production-certified build**. Syntax and static file checks do not prove live Supabase behavior or iOS layout correctness.
- The read-only Watch screen relies on existing SELECT RLS for `games`. It does not grant new viewing permissions.
- Role-specific database policies are not created by this revision; front-end visibility restrictions are not security.
- The earlier guest invitation/email/SMS/QR access product and automatic tournament bracket progression are **not completed** here. They were part of the wider product roadmap, not among the 43 UI corrections.
- Existing `MIGRATION_*.sql` files from the consolidated baseline are included. Do **not** re-run migrations blindly. Check which were applied previously in staging and review SQL dependencies/permissions.
- Supabase `supabase-config.js` contains a public/publishable browser key, not a service-role credential; verify credentials in the actual deployment.

## Deploy safely

1. Backup your deployed source and database; test in a separate branch and staging Supabase project.
2. The archive contains a `scoridium/` directory. Copy its *contents* into your existing repo root, not a nested directory.
3. Review the companion `scoridium_revision43_changes.patch` for changes relative to the combined candidate.
4. Validate on mobile portrait and iPad portrait/landscape, including shot marker redraw, static caching and active game recovery.
5. Verify no unrecognized user can post official game events; perform cross-account, quarter-end and four-quarter simulation tests before production.

Suggested commit on a test branch:
```
git checkout -b scoridium-revision-43
git add .
git commit -m "Revise Scoridium navigation, Game Hub, roster, opponent stats and live viewing"
git push -u origin scoridium-revision-43
```
