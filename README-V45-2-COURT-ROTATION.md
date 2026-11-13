# V45.2 Court rotation visibility fix

- Fixes old CSS hiding the court on short landscape phones.
- Removes inline dimension writes on orientation change that could collapse the calibrated court.
- Adds a final stylesheet to make portrait and landscape court layout deterministic.
- Preserves existing court SVG, coordinates, tap actions, observation data, and game-event logic.

## Testing checklist
1. Open Game > Court on phone portrait; confirm half-court appears.
2. Rotate to landscape and back repeatedly; court should remain visible and tappable.
3. On iPad portrait, switch Half/Full Court and rotate; ensure both render.
4. Record a make and miss; verify markers remain after rotation and play-by-play remains correct.
5. Confirm no duplicate events; the rotation itself must never record shots.
6. Confirm the Game Hub/Track/Review tabs still work.

No Supabase SQL change is required.
