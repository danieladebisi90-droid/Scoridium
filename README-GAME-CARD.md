# Scoridium — Mobile Games contextual card

## Install
Back up your current project. Copy only `gamehub.html`, `gamehub.js`, and `gamehub-mobile.css` into the same directory in your existing Scoridium repository, replacing those files. Do not replace the rest of your project.

Run:
```
git add gamehub.html gamehub.js gamehub-mobile.css
git commit -m "Make mobile Games show next game and selected past box score"
git push origin main
```

## What changed
- Portrait mobile: calendar -> selected day's games/team events -> one contextual game card. No Season Games table.
- Opening the page defaults to the earliest upcoming scheduled/live game, determined by the current local date. Tapping future games or practices does not change that card.
- Tapping a date with completed game(s) displays the latest game completed on that day, score and VIEW BOX SCORE; it links to `stats.html?gameId=...`, already supported by Stats Game Details.
- Tapping the same date again clears the selection and restores the next-game card.
- If there is no upcoming game, falls back to the latest completed game (or shows no games available).
- Calendar-selected day details display games as well as practices and meetings.
- Desktop controls and live tracker files not changed.

## Verify on iPhone
1. Calendar initially shows next upcoming game in lower card.
2. Select future game date: calendar detail changes, card remains next upcoming game.
3. Select completed game's date: card says PREVIOUS GAME, shows score, and VIEW BOX SCORE opens selected game's Stats details.
4. Tap the selected date a second time: card returns to NEXT GAME.
5. Open next game: correct game ID used for tracker.
6. Desktop Game Hub still works.

Note: The code passed JS syntax checking; actual device/Supabase integration is not tested here. Because this was based on your previously uploaded snapshot, review differences if your `gamehub.js` was modified since that ZIP.
