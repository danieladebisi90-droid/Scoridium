# ApexVision major update — implementation status

This change set is **an integrated foundation, not the complete 14-area release**. It is based on the uploaded `apexvision-current.zip` **plus** the earlier Phase 1 and Phase 2 Patch 1 changes. Do **not** apply it to the raw ZIP or older branches.

## Implemented in this patch

- Player and Opponent Traditional Zone selector now invokes the Traditional zone diagram builder rather than the incompatible generic builder.
- Opponent Stats full court plus vertically stacked Our Offence and Our Defence zone half-courts. Independent Basic / Traditional / Distance selectors.
- Standard Player Efficiency (EFF) column in Players table and game box scores; per-game and total options.
- Assist Connections Team Stats visualization, only when explicit `assist.linked_event_id` points to a made shot from the same team. No invented passing relationships.
- Player and Team full-court shot result / creation marker layer. Without film tags, creation is marked unknown. Requires the film SQL migration before real classifications can be loaded.
- `film-analysis.html` optional annotations for shot creation, contest, turnover causes, and defensive scheme. Server-side RPC does not change official stats. Cannot yet tag court locations, possessions, or provide scheme-based efficiency ratings.
- `add-score.html` team-member/parent score submissions and coach/manager approval. Supports total only or quarter totals plus overtime. No official game score edits until approved. No fabricated player game events.
- Game Hub links to Submit Score and, for existing eligible trackers, Film Analysis for previous completed game.
- `Tracking Room` popup replaces the role dropdown; the existing Stat Tracker claim, guard and takeover authorization logic remain unchanged. Live activity and names are not guaranteed; identity remains hidden.

## Supabase SQL required

Review and run **in this order**:

1. `MIGRATION_APEXVISION_FILM_ANALYSIS.sql`
2. `MIGRATION_APEXVISION_SCORE_SUBMISSIONS.sql`

Both files depend on your existing Supabase schema. Film annotations also require the existing `private.can_track_game(uuid)` function. Do not deploy without checking database compatibility and policies.

## Not yet implemented / unverified

- Calendar-based temporary or permanent tracking grants, their administration page, or changes to existing `private.can_track_game` authorization.
- True recorded-game backfill of *official* box score and shot tracking independent of live status. Film metadata annotations are separate and do **not** implement backfill.
- Full-container Quick Track linked-action transitions.
- Additional roster/cache optimization and phone rotation lifecycle fixes.
- Player Profile shooting analytics (catch-and-shoot %/pull-up %) and advanced turnover/steal location maps, defence possessions, scheme efficiency, and all advanced metrics.
- Complete play-by-play/opponent stats reconciliation and full two-device game testing.

## Verification performed

- `git apply --check` and `git apply` against an exact copy of Phase 1 + Phase 2 Patch 1 baseline.
- `node --check` for each changed JS file.

No deployed application, user browser, iPad/iPhone, or live Supabase instance was available for end-to-end verification. Apply this patch to your exact current repository only after `git apply --check`, test in a nonproduction Supabase project before approving scores, and keep a git rollback commit.
