# ApexVision coordinated update — 2026-11-22

Source snapshot: ApexVision-Test(1).zip. This is a candidate for staging, NOT an approved production deployment.

Changed application files: script.js, quick-track.js, postgame-live-quick.js, gamehub.js. Original layouts and assets unchanged.

Implemented:
- Deleting a linked child event no longer deletes its parent. Deleting a parent recursively removes its dependent events.
- After a confirmed made-to-missed shot edit, attached assist events are removed and the removals are queued for synchronization. Editing and deletion are blocked while unsynchronized writes remain.
- Both Live Quick Track and Film Room quick workflow defer recording a MADE foul shot until the FT shooter is selected; missed shooting fouls do not create field-goal attempts. Existing attempts are not recreated when marked already recorded.
- Back from the FT-shooter choice restores the foul display without saving a duplicate foul. Once the foul is committed, its settings cannot be changed via Back: this is a safeguard, not full editable history.
- Default team-foul penalty uses a fifth-team-foul threshold (FIBA-style) with optional window.ApexBasketballRuleConfig.bonusThreshold override; null falls back to manual. The rule and overtime handling must be checked for the competition.
- Game Hub tracking grants are re-evaluated and expiry/revocation fields checked. Requires revoked_at and expires_at to exist in the target DB table. If missing, the UI fails closed; verify your migration first. Server-side RLS remains authoritative.
- More explicit Unknown Player label for missing tracked player attribution, and Live Last Event is derived from the local event history when idle.

Automated checks: 50 JavaScript files pass node --check; 9/9 previous mocked Live Quick Track scenarios pass. These mocks do not verify database state, production authorization, iPad UI, concurrency or Film Room persistence.

Still requiring staging verification or additional implementation before release:
- Supabase table columns, RLS and authenticated RPC policies (no live credentials/test DB available).
- End-to-end Film Room Combined, Shot, Guided/Free and cross-device data propagation.
- Complete transactionality of shot-edit and assist-delete across connection loss; pending recovery journal can still require human reconciliation.
- Correct semantics and persistence of out-of-bounds versus team rebound: server schema needs design review.
- Explicit unresolved FT sequence review entries; currently skipped attempts leave UI warning only.
- Film Room events and Last Event after network reconciliation, responsive phone/iPad/desktop visual testing.
- Bonus computation for leagues outside the default fifth-foul rule and special period handling.

Do not replace a deployed project before checking these. No migrations or deployments were executed.
