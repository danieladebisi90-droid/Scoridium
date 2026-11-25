# Combined Tracking focused update — November 22, 2026

Based on ApexVision Combined Court First Fix; preserves all other modes and original layout.

## Changes
- Court-first shot: court determines result/team/location, tracked jersey saves once, then existing contextual assist/rebound workflow. Opponent shots skip jersey.
- Stat-first shot: wait for prior save, resolve the saved event ID and link the location; reject incompatible court result/team/2PT–3PT and allow retry on save/link failures.
- Force refresh of postgame-live-quick.js by versioned URL.

## Browser checks still needed
1. Tracked make, 2PT: tap court, choose jersey, assist / no assist. Exactly one FGA.
2. Tracked miss: tap court, jersey, rebound / block. Exactly one FGA.
3. Opponent made/missed shot: no jersey prompt.
4. Stat-first: select jersey, record shot, then select matching location, confirm single attempt and correct location.
5. Refresh and check Play-by-Play, box score, and shot chart.

No migrations/deployments performed. Do not use with a real game until browser and Supabase tests pass.
