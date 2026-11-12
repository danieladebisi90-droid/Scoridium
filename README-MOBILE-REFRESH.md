# Scoridium — Simple Mobile Refresh

This is based on the Scoridium project previously uploaded in the conversation.

## Changes
- Mobile portrait: compact team header, bottom navigation (Home, Games, Roster, Stats, More), collapsible More menu.
- Game Hub mobile portrait: **Next Team Event**, existing monthly calendar, and scheduled activities for the selected day. Data uses current `games` and `team_events` records, without changing Supabase tables.
- On desktop: keeps previous navigation and Game Hub layout.
- In landscape live tracking: keeps tested three-column tracker, hides shell navigation.

## Deployment
Copy the **contents** of this folder into your existing GitHub checkout, preserving its `.git` folder. Back up newer files first. Run `git status`, inspect the diff, then `git add . && git commit -m "Simple mobile app layout" && git push origin main`.

## Tests
1. Open the installed PWA in portrait; the bottom nav should navigate between pages.
2. Open Games; calendar should show the real scheduled events and games.
3. Tap a calendar day; cards below the calendar should show activities or an empty message.
4. Open a game and rotate to landscape; original full-size three-column tracker should work.
5. Repeat on desktop to ensure original desktop layouts remain intact.

Note: A game list/management view remains available on desktop. Mobile Games deliberately focuses on the calendar and activities only. No demo schedule is inserted into the database.
