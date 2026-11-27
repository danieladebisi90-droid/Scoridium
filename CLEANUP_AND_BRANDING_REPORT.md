# ApexVision-Test: cleanup and icon update

Source: `ApexVision-Test (4).zip` (untouched). This is a non-destructive, staging-only cleaned export.

## Changes
- Removed only unreferenced legacy responsive variants, copied tracker scripts, obsolete mock layout, and old standalone shot-mode UI files listed below.
- Kept functional entry pages (`index.html`, `add-score.html`, `film-analysis.html`), active tablet/phone styles, `pageLayout.html`, all SQL migrations, and server `index.ts`. Some of these are used directly rather than linked from another page.
- Replaced `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` with the approved symbol-only black/white/silver/orange basketball icon.
- Added favicon references to HTML pages that lacked them.
- Updated manifest theme colour and PWA cache names, retiring the old `scoridium-pwa-` caches on service worker activation.
- Omitted the `.git` history **only from this distribution ZIP** to avoid overwriting your repository metadata; the untouched original ZIP still includes it.
- Did **not** modify live tracker workflows, Supabase credentials, SQL, layout breakpoint rules, or production.

## Removed files
- `ApexVision-Test - Shortcut.lnk` — local Windows shortcut not needed for web app
- `combined-tracking-responsive1.css` — unreferenced numbered layout variant
- `combined-tracking-responsive1.js` — unreferenced numbered layout variant
- `combined-tracking-responsive2.css` — unreferenced numbered layout variant
- `combined-tracking-responsive2.js` — unreferenced numbered layout variant
- `postgame-combined-ipad.js` — unreferenced superseded iPad layout script
- `postgame-live-quick1.js` — unreferenced numbered tracker variant
- `postgame-live-quick2.js` — unreferenced numbered tracker variant
- `postgame-live-quick3.js` — unreferenced numbered tracker variant
- `shot-tracking-modes.css` — unreferenced alternative shot-mode UI stylesheet
- `shot-tracking-modes.js` — unreferenced alternative shot-mode UI script
- `stat-layout-preview.html` — unreferenced mock preview page

## Checks
- 156 files retained, including 48 JavaScript files.
- `node --check`: 48 passed, 0 failed.
- HTML literal local asset reference checks: 0 unresolved (dynamic links not evaluated).
- Browser, actual iPad, live database, and PWA install tests **not executed**.

### HTML pages given favicon links
film-room.html, add-score.html, watch-game.html, film-analysis.html, postgame-track.html, offline.html

### Unresolved local references
None found.

### JavaScript syntax failures
None.

## Safe deployment note
Extract this cleaned build into a new folder, compare with your latest working directory, then test every tracking mode (landscape and portrait), editing, Play-by-Play, offline icons, and sign-in before merging into main.
