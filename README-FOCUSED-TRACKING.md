# Scoridium Full-Screen Tracking — layout update

Based on the latest Quick Track phone-portrait build. The original game logic and Supabase tables are unchanged.

## Changes
- App shell hides its header and bottom nav whenever game.html is open (all screen sizes).
- Dedicated Game Hub link remains available in the tracking screen.
- Track view opens as the default; player grid and tracked/opponent quick controls are its focus.
- Play-by-play view contains the existing Box Score / Play-by-Play / Unassigned tabs and event editors.
- Court view preserves the previous shot-court controls, tip-off overlay in mobile landscape, and original stat controls.
- Team quick-scoring and opponent headings use the current tracked team and opponent names.
- Phone swipe left from tracking to review and swipe right from review to tracking, plus explicit navigation buttons.

## Tests before using for a real game
1. Start a fresh test game, including tip-off and directions in Court view on mobile landscape.
2. Check tracked and opponent names for both home and away games.
3. Record a made shot, assist, miss, rebound, team score, and opponent PF.
4. Verify score and play-by-play agree after reload and on a second device.
5. Check Game Hub navigation on phone, iPad, and desktop.
6. Switch Track / Play-by-play / Court; test all three after device rotation.

These edits have undergone syntax/static checks only. They have not been tested against your live Supabase setup. Take a repository backup before deployment.
