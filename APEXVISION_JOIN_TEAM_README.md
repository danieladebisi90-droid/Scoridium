# ApexVision Auto-Join — test build

**Do not run `OBSOLETE_DO_NOT_RUN_JOIN_APPROVAL.sql`.** This ZIP replaces approval requests with direct team enrollment.

1. Extract the ZIP separately from your working project.
2. In **ApexVision-Test** Supabase project SQL Editor, review and run **`MIGRATION_APEXVISION_JOIN_TEAM_AUTO.sql`**, only after backup. Do not run on Main.
3. Serve the project through a local web server (not `file://`). Sign in as team `head_coach`; My Teams has a Share Team panel with Generate / Rotate Link, QR, member list, and Disable Invite.
4. If testing across devices, the invitation URL must use a host accessible on the other device, not localhost. Production URLs will work after deployment.
5. Test with a separate account: scan/open link; use signup/login; confirm email, and enrollment completes automatically with Viewer access; other view-only labels are available for manual joins. Existing accounts join without signup.
6. Verify viewer can see team pages and cannot edit roster, game, or stats, including attempts through Supabase API, before inviting actual families. Test disable, rotate and remove-member access.
7. Supabase Auth **Redirect URLs** must allow the signup confirmation destination (`join-team.html` on the actual hostname). Ensure email verification is enabled.

**Security:** Random 128-bit invitation tokens, accessible only via privileged and authorisation-checked RPCs. Any holder of an enabled link can join read-only, so keep links private; rotate/disable on exposure. All mutation RPCs validate caller role. Existing RLS across other app tables is unchanged and must be tested with viewer accounts. No DB changes were applied by this package.

**Notes:** QR rendering uses pinned `qrcodejs@1.0.0` from jsDelivr. If unavailable, copy the link. Admin emails are visible only to the head coach via a gated function. Coach memberships use `coach_viewer` not legacy write-capable `coach`.
