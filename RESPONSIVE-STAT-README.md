# Stat Tracking responsive correction

This test build replaces the former final Stat Tracking layout CSS section with one stylesheet: `stat-tracking-responsive.css`. It is linked after `postgame-responsive.css` in `postgame-track.html`.

The previous final section was removed from `postgame-responsive.css`. Earlier historical stat-specific rules had already been removed in the source clean build. Other styling for Shot Tracking, Film Analysis, and shared application components is retained.

## Browser layout check

A static test using the real markup structure and styles was rendered in Chromium at these viewport sizes (CSS pixels):

| Viewport | Tracked-team panel | Opponent panel | Opponent button | Horizontal overflow |
|---|---:|---:|---:|---|
| 375x667 | 140 | 154 | 44 | No |
| 440x956 | 179 | 186 | 57 | No |
| 768x1024 | 210 | 219 | 67 | No |
| 1180x700 | 183 | 206 | 59 | No (vertical scrolling allowed) |

These are fixture-based layout measurements, not verification of a connected game or functioning Supabase events. The roster logic and JavaScript event handling were not edited. Test a live post-game gameId on each viewport before adopting for production.
