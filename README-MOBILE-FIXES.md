# Scoridium — Combined portrait mobile fixes

Apply **only** these 7 files to your existing Scoridium repository. Back up / commit your current code first.

- `dashboard.html`, `dashboard.css`, `Dashboard.js`, `dashboard-mobile-event.js`
- `gamehub-mobile.css`
- `roster.css`
- `player.css`

## Exact changes
1. Dashboard: Team Overview → **Next Team Event** → Team Roster. Weekly Schedule, Team Leaders, Recent Games remain hidden on portrait phones. The next event is relocated *inside* the Dashboard's existing lower section so it can't be dropped by a `display:contents` layout. The Supabase-powered next-event script remains included.
2. Dashboard roster: the live player carousel becomes a **manual horizontal swipe row on phones**. The auto-scroll duplicates and Web Animations continue only on desktop. Player cards are not removed and remain clickable.
3. Games: existing calendar and selected-date activities, followed by the existing **Next Game / Open Game** card. The Season Games table is hidden on portrait phones only. Selecting scheduled games still uses the existing Game Hub logic.
4. Roster: reduce oversized player search area to **40px high**, retain full available width, and keep Add Player button below it.
5. Player Profile: hide Recent Games from Overview on portrait phones only; Game Log remains present.

No Supabase writes, scorekeeping, tracker, or desktop styles are intentionally changed.

## Install
1. Back up current working files and copy the seven files above from the ZIP to the root of the existing Git repository.
2. Run `git diff` to inspect changes, then:
   `git add dashboard.html dashboard.css Dashboard.js dashboard-mobile-event.js gamehub-mobile.css roster.css player.css`
   `git commit -m "Fix portrait mobile dashboard games roster and profile"`
   `git push origin main`
3. Wait for GitHub Pages deployment, close/reopen installed app, and test at phone portrait width.

## Important
This is a source-level patch based on the latest project previously uploaded here plus the recent mobile patch. It has **not** been verified against a live Supabase account or tested on an actual iPhone. If there have been local edits since that upload, inspect diffs and merge rather than blindly overwrite newer work.
