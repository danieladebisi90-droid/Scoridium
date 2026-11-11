# Scoridium consolidated mobile fixes

This is a full working-tree snapshot assembled from the last project ZIP shared in chat, the combined mobile fixes, and the latest Games context-card patch. **It is not automatically synchronized with your GitHub repository.** Back up your current code and compare changes before copying.

## Included
- Roster search now has an input event handler.
- Roster Team Information / Staff tabs are clickable. Team Information shows existing team fields. Staff shows a clear *not configured* message, because no staff table/schema was supplied.
- Mobile Next Team Event overflow constrained.
- Dashboard roster automatically creeps sideways and pauses for manual swipe; reduced-motion preferences respected.
- Team ticker refreshes on app focus and periodically; next-game date uses local date.
- PWA checks for updates and offers Update / Later; no forced reload while tracking.
- LEFT/RIGHT pregame button fix and mobile Back button restored.
- Shared LEFT/RIGHT orientation if `MIGRATION_DIRECTION.sql` is applied and existing RLS permits authorized updates.
- Latest Game Hub: calendar -> selected activities -> default next game or selected completed game with View Box Score.

## IMPORTANT database step
Run `MIGRATION_DIRECTION.sql` in the Supabase SQL editor **after reviewing existing games RLS policies**. This adds a field, not an RLS policy. If updates are blocked by RLS, directions will fail to synchronize; don't grant unrestricted update permissions. Realtime subscription must be active for games.

## Deployment
1. Back up your Git repository and do `git status`; commit/backup any current changes first.
2. Use a diff/compare tool to merge these files instead of blindly overwriting any newer versions.
3. Test on a separate test game and test team.
4. `git add . && git commit -m "Consolidate Scoridium mobile QA fixes" && git push origin main`.
5. Test iPhone and desktop for roster search, team tabs, next event, marquee, calendar -> game card, cross-device direction, and update banner.

**Limitations:** Not live-tested with Supabase or Safari. Staff data cannot be added without knowing the actual schema. Direction sync depends on a successful migration and RLS. The PWA update notice may only appear when a new service worker version is published, not on every CSS edit.
