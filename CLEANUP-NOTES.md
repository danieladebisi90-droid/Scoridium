# ApexVision layout cleanup — first safe pass

Removed historical CSS selectors explicitly scoped to `.pg-v3-stat` from the consolidated `postgame-responsive.css` and retained the final unified stacked Stat Tracking layout as its sole stat-specific set. Mixed CSS selector lists were split so other modes keep their declarations.

**Not removed:** general shared layout declarations, Shot Tracking and Combined Tracking CSS and JavaScript, and mobile/review scripts. These must be consolidated by tracing active event handlers and verifying behavior; filenames with v5–v10 are not evidence that the files are unused.

**Not yet done:** visual browser testing or gameplay verification. The existing final stat layout still needs refinement for dynamic sizing; this pass removes conflicts, not a new finished visual design.

Test Stat Tracking on the four target screen sizes, then test Shot Tracking and Film Analysis, including navigation, saving events, and restoring sessions. Keep a backup of your prior folder.
