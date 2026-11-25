# Scoridium PWA integration

This ZIP is your uploaded Scoridium project with *additive* PWA support. The current tracker logic, Supabase config, HTML page navigation and existing scripts are preserved.

## What was added
- `manifest.webmanifest`: install name, scope and launch page (`myTeams.html`)
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`: starter Scoridium icon
- `pwa-register.js`: registers the service worker only in top-level pages
- `service-worker.js`: network-first navigation with offline fallback; does **not** cache JS/CSS, authenticated pages, tracker responses, Supabase API calls or live game data
- `offline.html`: explicit offline message
- manifest/icons/iOS app meta tags and PWA registration included in existing HTML pages

## Deploy
Copy the updated contents over your GitHub Pages repository root, preserving the same names. Commit and push to your publishing branch, and wait for GitHub Pages to publish. Use HTTPS (GitHub Pages provides it). Do not place the folder itself *inside* your repo if current HTML files are at repo root.

## Test on iPhone
Open the GitHub Pages site in Safari, sign in, go to Share -> Add to Home Screen, and choose Open as Web App (if offered). Launch from the icon. Expect no Safari address and tab bars, but iOS status and gesture UI can remain. Sign-in and team selection may need to be repeated in the installed context.

## Test on Android/Desktop
In Chrome, open the published site and choose Install App / Add to Home Screen in the browser menu when available.

## Important limitations and launch checks
- **This is not offline tracking.** The service worker intentionally avoids caching game operations. Your existing pending-event recovery must be tested separately with a full-game rehearsal. Don't trust an offline fallback as confirmation that stats were saved.
- **PWA install is not data security.** Confirm Supabase Row Level Security for every team/game/event table and test separate user permissions; this archive cannot prove backend RLS is correct.
- This update does not submit the app to the Apple App Store or Google Play.
- The starter logo is a simple S. symbol. Replace icons later with your final brand art if you wish.
- The site's `index.html` currently forwards to `myTeams.html`. That is retained deliberately, and the install start page directly uses `myTeams.html`.
- `app.html` needs a selected team stored in sessionStorage; launching via `myTeams.html` avoids direct-launch redirect surprises.
- Check the live security-warning situation before sharing login links with coaches.
