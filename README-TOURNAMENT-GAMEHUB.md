# Scoridium — Calendar / Game Hub Tournament Milestone

## Source / merge precautions

These files are based on the **available local Scoridium release snapshot**, not a verified checkout of the live deployment. Back up your repository. Compare diffs and merge rather than replacing newer files blindly. No Supabase table has been altered by generating this ZIP. Do **not** run a migration against production before reviewing it in a staging database.

## Files

- `gamehub.html` — adds calendar-context panel, tournament creation dialog and links.
- `gamehub.js` — keeps Next Game fixed, uses calendar date selections, includes tournament date indicators and broadens *UI* schedule management roles (DB RLS must also permit intended roles).
- `tournaments.js` — loads tournament date ranges; interactive Tournament Hub; optional-name/date-range creation; add/edit external tournament match results; bracket overview; same-season previous meetings, aggregate available events and player stats.
- `tournaments.css` — adaptive secondary-color tournament highlights, mobile context visibility, responsive editor and enlarged bracket view.
- `Dashboard.js`, `dashboard.css` — weekly schedule shows tournaments across their dates using an adaptive team secondary-color shade.
- `MIGRATION_TOURNAMENTS.sql` — new tournament, external-match, helper-permission tables with authenticated role-restricted RLS. Does not modify existing `games`/`game_events`.

## Deployment sequence

1. Back up current app and database; apply SQL to **staging** first. Validate grants and existing role names (`team_members.role`) and team/season foreign keys.
2. Merge the six source files into the matching project; deploy to staging; ensure Supabase `authenticated` table grants and the expected RLS are configured.
3. In Game Hub, create a tournament from Schedule > Tournament or Add Tournament. Enter dates; leave name empty to use `Tournament`.
4. Confirm all dates in the range highlight (both monthly calendar and Dashboard weekly schedule). Verify contrast for very light and very dark secondary colors.
5. Select a tournament date; check Tournament Hub, expand bracket and add an external game with TBD teams. Add scores, confirm results, reload and verify persistence.
6. Select a regular-season date; verify completed same-season meetings against the same named opponent and available event/team/player stats. Confirm Next Game stays unchanged.
7. Check phone portrait and tablet views and role-specific access. Confirm nonstaff cannot create a tournament or edit results unless explicitly granted as a tournament helper.

## Supported in this milestone

Tournament creation **without known games**, optional names, a date range, entry/editing of external scores, a readable expanded match listing (not a full bracket graph), contextual Game Hub, historical opponent data (available events only), and per-team calendar colors. Next Game remains independent of selected calendar date.

## Not implemented / not verified

- **Automatic bracket progression, tournament standings/tiebreakers, and automatic creation/update of future calendar games** from external results require explicit bracket or pool progression rules; they are **not** implemented here. External result rows do not create player stats or official game events.
- Inviting helpers by SMS/email, granting multi-game/tournament guest access, and a helper-grant UI are not implemented. The SQL creates scoped helper permissions but an authorized admin must provision them through a separate audited workflow.
- The larger release backlog (Court rendering fix, tracker guest roles, navigation animation, PWA status bar, roster editing, etc.) is **not** completed by this milestone.
- No real Supabase migration, device test, or live-browser test was performed in this environment. JavaScript parses under `node --check`, and HTML contains expected controls.

## Commit after staging passes

```sh
git add gamehub.html gamehub.js tournaments.js tournaments.css Dashboard.js dashboard.css MIGRATION_TOURNAMENTS.sql
git commit -m "Add tournament scheduling and contextual Game Hub"
git push origin main
```
