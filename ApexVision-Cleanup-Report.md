# ApexVision codebase cleanup — November 19, 2026

## What was done

This is a **conservative cleanup** of the uploaded `ApexVision-Test.zip`, not a wholesale rewrite. It prioritizes not breaking live tracking or database functionality.

- Removed the bundled `.git` internals (commit object database, hooks, and logs) from the **distribution ZIP only**; the original uploaded ZIP remains untouched, so it retains Git history.
- Removed `.DS_Store` macOS metadata.
- Archived **5 unreferenced CSS/JS files** (none are referenced by remaining runtime code; historical documentation may still mention them).
- Archived **9 historical `.patch` files** (these aren't runtime assets).
- Archived **22 historical README and fix-note files**. Kept `README_FILM_ROOM_GAMEHUB_20261117.md` and `README-PWA.md`.
- Removed one redundant commented-out `postgame-ipad-stat-landscape.css` link from `postgame-track.html`. The active stylesheet link remains intact.
- **Preserved all SQL and migration files, the Deno `index.ts`, app screens, current JavaScript, and active CSS.**

## Legacy files retired from the app ZIP

### CSS / JavaScript with no project references

- `game.css`
- `postgame-ipad-landscape-v2.css`
- `postgame-ipad-landscape-v2.js`
- `postgame-mobile-v7.js`
- `postgame-quick.js`

### Historical patch snapshots

- `apexvision_phase1_changes.patch`
- `apexvision_phase1_current_repo.patch`
- `apexvision_phase2_courts_gamehub.patch`
- `scoridium_ipad_fullscreen_scoreboard_fix.patch`
- `scoridium_ipad_tracking_layout.patch`
- `scoridium_matching_recovery_manual.patch`
- `scoridium_quarter_fingerprint_after_return.patch`
- `scoridium_shot_matching_one_tap_update.patch`
- `scoridium_shot_matching_v1.patch`

### Historical documentation / notes

- `README-CHANGES.md`
- `README-CONSOLIDATED-CANDIDATE.md`
- `README-CONSOLIDATED.md`
- `README-FOCUSED-TRACKING.md`
- `README-GAME-CARD.md`
- `README-GAME-VIEWER-V45.md`
- `README-MAJOR-UPDATE-44.md`
- `README-MOBILE-FIXES.md`
- `README-MOBILE-REFRESH.md`
- `README-NEXT-UPDATE.md`
- `README-PERSISTENT-SHELL.md`
- `README-QUICK-TRACK-POLISH.md`
- `README-QUICK-TRACK-V2.md`
- `README-QUICK-TRACK.md`
- `README-REVISION-43.md`
- `README-SMOOTH-NAVIGATION.md`
- `README-TOURNAMENT-GAMEHUB.md`
- `README-V44-1-FIXES.md`
- `README-V45-2-COURT-ROTATION.md`
- `README.txt`
- `README_APEXVISION_MAJOR_UPDATE.md`
- `V45_1_FREE_THROW_PLAY_BY_PLAY_FIX.txt`

## Checks completed

- 22 HTML entrypoints scanned for missing relative references: **none**.
- 46 retained JS files passed `node --check`: **yes**.
- The live `postgame-track.html` still loads all active Film Room assets (including current portrait/landscape/phone implementations). The legacy `.git` folder is not necessary for the site to run.
- SQL migrations and Supabase-related source code have not been changed.

## What was *not* done (requires runtime testing)

The Film Room still has multiple actively loaded generations of styles, such as `postgame-layout-v5.css`, `postgame-layout-v6.css`, `postgame-mobile-v7.css`, `postgame-mobile-v8.css`, and `postgame-responsive-v9/v10.css`. They **cannot safely be deleted simply because of their version numbers**. The active phone, shot, stat, and combined workflows may depend on rules or handlers from each. Consolidating these requires testing in an actual browser with sample games and a connected backend. This cleanup deliberately leaves those alone.

This package has **not been browser-tested against Supabase or authenticated saved games**. Please test the key workflows before using it as your only copy.

## Package counts

- Total extracted non-Git, non-metadata files: 181.
- Archived auxiliary files: 36.
- Current app files retained: 145 (plus this report and a fresh README).
