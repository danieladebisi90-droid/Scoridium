# Scoridium major update candidate v44

This is an integrated source-code package built from the supplied Revision 43 V2 files. It has not been deployed to GitHub Pages or connected to a live Supabase database in this environment.

Implemented in this candidate:
- One combined Next Game / Live Game card; centered VS layout, scores, quarter and tracker/viewer actions. Mobile game context supports live state too.
- Dashboard live scoreboard: VS and secondary-colour live badge.
- Roster record reads completed games for the selected team and season (same logic as Dashboard). Session-scoped roster rendering cache with fresh background fetch.
- Roster edit popup with player list and form. Grade 9–12 persisted by a new grade-aware SQL RPC migration and displayed as Freshman, Sophomore, Junior, Senior.
- Mobile shell hides bottom navigation while an embedded modal is open.
- Tournament creation supports game date, time, opponent, round and court details rather than adding empty placeholder matches. A tournament may have zero games.
- Opponent Stats: single-game comparison bars, full opponent/date/score heading, hide aggregate tiles in single-game mode, preserve empty shot court with overlay, scrollable three-court strip.
- Player Stats includes basic/traditional/distance inline controls over its existing half-court preview.
- Global stylesheet suppresses team emblems and logos on the main app pages.
- Human-readable date-display helper and date formatting on core stats/game views.
- PWA update waits for user approval before activating new service worker, uses network-first static files, and avoids automatic game-tracker reloads.

## Installation
1. Backup the current project. Extract the package contents, keeping the `scoridium/` directory layout or copying its contents to the repository root as appropriate.
2. Review and run `MIGRATION_ROSTER_EDITOR_GRADE.sql` in **staging Supabase** after `MIGRATION_ROSTER_EDITOR.sql`. Also ensure `MIGRATION_TOURNAMENTS.sql` has been applied. These SQL files modify database functions/tables and must not be skipped for grade writes/tournaments.
3. Test on staging with a real coach, viewer, existing completed game, upcoming game, live game, and mobile PWA. Then deploy to production if successful.
4. After deploy, open the installed app, accept Update, and verify that the new worker takes control and reloads the latest assets. Do not test updates during an active tracking session.

## Limitations requiring testing/follow-up
- No live Supabase access was available for end-to-end verification. Schema compatibility and RLS permissions must be validated on staging.
- The build has JS syntax validation, but not browser/device visual regression testing.
- Some older non-core date strings elsewhere in the product may still require conversion to the common full-date formatter.
- Opponent-side non-score stats remain unavailable when not recorded; bars show — rather than invented values.
- Tournament court location is saved in `source_note`, not a dedicated structured venue column.
- True push/realtime updates depend on the existing application's Supabase subscription behavior.
