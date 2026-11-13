# Scoridium V44.1 UI regression hotfix

- Correctly detects genuinely visible modals so Games and Stats no longer hide the floating navigation due to hidden dialog descendants.
- Fixes Roster overview using 2 columns rather than an obsolete 4-column layout; resets mobile banner flex sizing.
- Renders centered responsive mobile LIVE scoreboard with team scores, VS, quarter, secondary-color LIVE badge and View Game link.
- Fixes PWA controllerchange handler missing refreshOnController initialization.
- Refreshes CSS URLs and service-worker cache identifiers.

Performance: app navigation still reconstructs its iframe page and each module can load data separately; broader caching/refactoring is **not** implemented in this hotfix. No Supabase SQL required.

Validate after deployment on iPhone Safari/PWA and desktop: dock visibility on all four pages, modal open/close, roster banner, dashboard live display, Update button and games tracking safety.
