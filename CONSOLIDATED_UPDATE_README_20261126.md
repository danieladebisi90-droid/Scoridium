# ApexVision consolidated test build — November 26, 2026

Source: uploaded ApexVision-Test (4) cleaned project, plus latest Stats redesign and Game Hub non-phone layout patches from this session.

## Includes
- All four Stats tab redesigns and navigation styling from Stats redesign update.
- Assist Connections popup updated to show most assisted teammate and most assists received from, with recorded totals.
- Latest non-phone Game Hub two-column layout stylesheet.
- Dashboard fixed Supabase `games.period` missing-column request. Stops live poll and logs once if a future query fails.
- Dashboard unified automatic, native horizontal roster scrolling, manual swipe/drag, responsive card widths, hover/touch pause, reduced-motion support.
- Existing cleaned logo/favicon and app icon assets retained.

## Test safely
1. Unzip into a NEW folder rather than overwriting the working ApexVision-Test folder.
2. Open in VS Code Live Server, sign in to the test Supabase, and check Dashboard / Stats tabs / Game Hub.
3. Verify Dashboard Network tab no longer shows `column games.period does not exist`.
4. Test roster on desktop and physical iPad in portrait and landscape, including swipe, reflow and pause; check the team-news ticker and no clipped cards.
5. Hover and tap assist nodes; confirm direction and counts.
6. Verify Game Hub action buttons and Film Room.

No Supabase database migration or production data changes have been made. **Not automatically merged into GitHub main.** This is not an end-to-end tested release. The source project is an earlier uploaded snapshot and may not contain any edits made locally after that upload. Compare against your working folder before replacement.
