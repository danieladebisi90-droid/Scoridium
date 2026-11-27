# ApexVision — Phone QR invitation fix (test build)

## Root cause identified in the previous test build
The Share Team QR was generated from `location.href` inside `myTeams.js`. If you opened ApexVision at `http://localhost:4173`, the resulting QR linked to **localhost** on the phone, which is the phone itself, not your Windows PC. A QR code cannot make a local development server reachable from another device.

## What changed
- The admin three-dot Share Team popup has a **Website address for phone invitations** setting.
- Localhost / loopback addresses cannot generate a misleading QR or link. Instead, the popup explains the problem and keeps the manual code visible.
- Enter your deployed HTTPS app base URL (preferred) and click **Use Address**.
- For temporary Wi-Fi tests, enter your local computer's `http://192.168.x.x:4173/` address with both devices on the same network and your dev server exposed to the LAN. This is not suitable for onboarding remote parents, and mobile browser clipboard/authentication features may require HTTPS.
- The address is saved in **the admin browser's localStorage only**. The invitation code itself remains controlled by Supabase. Changing the address **does not** change the invitation code or the database.

## Test sequence
1. Run ApexVision from a host reachable by the phone (prefer deployed HTTPS site).
2. Log in as head coach; My Teams → team three dots → Share Team.
3. Generate invite if needed. In **Website address**, enter the exact root address where `join-team.html` is actually deployed, e.g. `https://your-domain.example/app/` (not `join-team.html`). Click **Use Address**.
4. Copy the generated link and paste it into the phone browser. It must open Join Team before attempting the QR scan. Then try scanning the QR.
5. In Supabase-Test dashboard → Authentication → URL Configuration, set a safe Site URL and add the exact hosted redirect URL/pattern (including `join-team.html`) to allowed Redirect URLs. Ensure email confirmation flows work for a new user.
6. Sign up / confirm email / sign in with a **second test account** and verify the membership appears on My Teams. Confirm the account cannot modify team data.

## No extra SQL needed
This is a client-side fix only; reuse the `MIGRATION_APEXVISION_JOIN_TEAM_AUTO.sql` already installed in ApexVision-Test. Never run that same migration in Main solely for this QR test.

## Known limitation
The updated app doesn't host or deploy your website. If only a PC localhost development server exists, you still need a publicly reachable hosting site to invite users outside your Wi-Fi network. Also verify that your hosting provider serves the entire ApexVision site, including join-team.html, signup.html, Login.html, myTeams.html, and the Supabase client configuration.
