# ApexVision — Streamlined project package

This copy builds on `ApexVision-Cleaned.zip` and consolidates **14 actively loaded Post-game CSS files into one** `postgame-responsive.css`, reducing the app asset count by **13**. The Film Room HTML now has one Post-game CSS link.

## Important scope

- The CSS is concatenated in the **exact original link order**, with each original file name marked inside comments. Rules are not reordered, deleted, or rewritten. It is a safe packaging consolidation, **not yet the new phone-first responsive design**.
- All currently active post-game JavaScript remains separate and unchanged. Those scripts may depend on execution order and cannot be collapsed safely without testing.
- Existing SQL migrations, pages, images, and Supabase code are unchanged.
- The cleaned project is not live-tested with a logged-in account, database, or physical device. Verify Stat/Shot/Combined tracking before relying on it.
- A consolidated CSS file still contains overlapping old rules. To truly remove redundant CSS, we need browser regression testing, so we intentionally did not delete rules blindly.

## Merged stylesheets, in their original cascade order

1. `postgame-track.css`
2. `postgame-layout-v5.css`
3. `postgame-layout-v6.css`
4. `postgame-mobile-v7.css`
5. `postgame-mobile-v8.css`
6. `postgame-responsive-v9.css`
7. `postgame-responsive-v10.css`
8. `postgame-ipad-stats.css`
9. `postgame-phone-review.css`
10. `postgame-phone-shot.css`
11. `postgame-ipad-shot.css`
12. `postgame-ipad-stat-landscape.css`
13. `postgame-ipad-landscape-final.css`
14. `postgame-combined-ipad.css`

## Verification

- 46 retained JavaScript files passed syntax checks with Node.
- Local HTML references: no missing CSS, JS, image or manifest targets detected.
- Project files in new distribution: 134.
- The original `ApexVision-Test.zip` and conservative `ApexVision-Cleaned.zip` are unchanged.

## Next step

Use the existing phone Stat Tracking interface as the design source. Simplify styles *inside the consolidated stylesheet* and verify one change at a time. In landscape, position tracked and opponent teams side by side; in portrait, stack them.
