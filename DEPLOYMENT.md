# Deploy to Supabase and Cloudflare Pages

No paid AI APIs are needed. You must create the free-tier accounts yourself and stay within their current limits. Frontend builds produce `dist/`. A custom domain is optional.

## 1. Supabase database

Install the Supabase CLI using its official installation instructions and authenticate it. Docker is needed only for a local Supabase stack.

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For a manual SQL-editor setup, apply every committed migration in filename order, then run `supabase/seed.sql` for issue categories. Prefer migrations for reproducible deployments. Do not create the default admin in a public project. Follow [ADMIN_SETUP.md](ADMIN_SETUP.md) with a unique password.

Local backend:

```sh
supabase start
supabase db reset
supabase functions serve api --env-file supabase/.env.local
```

Set your local frontend URL/anon key in `.env` and `VITE_DEMO_MODE=false`. Local credentials appear in the CLI's status output; use them only locally. Do not commit `supabase/.env.local`.

## 2. Edge Function

```sh
supabase secrets set ALLOWED_ORIGINS=https://YOUR_PROJECT.pages.dev
supabase functions deploy api --no-verify-jwt
```

Set `ALLOWED_ORIGINS` to the browser origin without a trailing slash, for example `https://publicpulse.pages.dev`, not `https://publicpulse.pages.dev/`. This is a **Supabase Edge Function secret**, not a Cloudflare build variable or Supabase Auth redirect URL. The function normalizes configured URL values to their origins and trims whitespace; redeploy the function to install that source fix. Unapproved origins are never reflected in CORS response headers.

For the deployed PublicPulse project, the correction is:

```powershell
npx.cmd supabase secrets set ALLOWED_ORIGINS=https://publicpulse.pages.dev --project-ref kphuysgfmfvwhvgzfubn
npx.cmd supabase functions deploy api --project-ref kphuysgfmfvwhvgzfubn --no-verify-jwt
```

Then reload the login page. In browser Network tools, the `OPTIONS` response should contain `Access-Control-Allow-Origin: https://publicpulse.pages.dev` exactly. No Cloudflare frontend rebuild is required for this backend-only correction.

`verify_jwt=false` is intentional: `login` and the generic reset request are public operations. Every other operation calls `auth.getUser(bearer)` and reads the actual profile role/activation on the server. Administrator operations explicitly require an active administrator with a completed password change. Do not remove these checks. CORS is not an authorization boundary.

The function uses Supabase's server-managed `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; never expose the latter to Vite. Multiple exact allowed origins may be comma-separated. Include preview origins only when you intend to permit those deployments. The import graph includes `src/lib/engine.ts` and `src/types.ts`; deploy from this repository root and preserve those paths.

The function's Deno import map pins its backend libraries. Check it with:

```sh
npx deno check --config supabase/functions/api/deno.json supabase/functions/api/index.ts
```

Public anonymous surveys and the source-dated geography importer have staging, production, and rollback steps in [PUBLIC_SURVEY_DEPLOYMENT.md](PUBLIC_SURVEY_DEPLOYMENT.md). Apply `202610190002_public_links.sql` before deploying the matching Edge Function/frontend. Keep the additive migration and public response history in place during an application rollback.

Disable public Auth sign-ups in Supabase. Use minimum password length 12 for real accounts, and review Supabase Auth's platform rate limits. The API additionally enforces ten login attempts per account and IP per 15-minute window. For real deployments behind a proxy, confirm that the proxy overwrites trusted client-IP headers and add edge abuse protection if necessary. Internal Auth email aliases are not actual mailboxes; password recovery is administrator-mediated.

## 3. Cloudflare Pages

Push this repository to a GitHub repository you control. In Cloudflare Pages, connect that repository and select:

```text
Framework preset: Vite
Build command: npm run build
Output directory: dist
Node version: 24
```

Set build variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_DEMO_MODE=false
```

All Vite variables are public and compiled into the bundle. The anon key is intended to be public; database RLS and Edge checks protect data. A service-role key must never appear here. The app deliberately fails closed when no backend is configured and demo mode is false.

`public/_redirects` provides React Router's SPA fallback. `public/_headers` adds baseline browser headers. `public/sw.js` caches only same-origin frontend GET assets for already-loaded field workflows; it never caches Supabase authentication or API requests. Do not point a production deployment to a database containing synthetic demonstrations unless the UI clearly identifies them.

Cloudflare assigns a `https://YOUR_PROJECT.pages.dev` URL. Add the exact URL to `ALLOWED_ORIGINS`, then redeploy the function if the value changed.

## 4. Optional GitHub deployment

`.github/workflows/check-and-deploy.yml` runs unit/database tests, TypeScript/build, and Chromium desktop/mobile workflows on pull requests and main pushes. E2E explicitly uses synthetic mode in its own dev server; the deployed artifact uses production build variables.

Set repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. To enable deployment, create a Cloudflare Pages project called `publicpulse`; add `CLOUDFLARE_ACCOUNT_ID` and scoped `CLOUDFLARE_API_TOKEN` as GitHub secrets; set repository variable `CLOUDFLARE_DEPLOY_ENABLED=true`; and configure the `production` environment protection rules as needed. The workflow deploys the already-verified build artifact. Use either this mechanism or Cloudflare Git integration as the deployment owner to avoid redundant deployments.

Database migration and Edge Function deployment remain explicit CLI operations, separate from static frontend deployment. Do not store the database service key in frontend CI variables.

## 5. Required live smoke checks

- Sign in as the bootstrapped admin; verify forced password change occurs before workspace data access.
- Create two field accounts, assign only one, and verify the other cannot read or submit against that survey.
- Verify direct anonymous database reads and direct authenticated writes are denied.
- Publish v1, collect one response, change the draft, publish v2, and verify the v1 answer labels remain unchanged.
- Submit the same response twice and confirm one record; replay modified content with the same ID and confirm rejection.
- Deactivate the assigned user and verify a cached token cannot submit. Reset their password and verify the change requirement is enforced.
- Try submissions outside dates/coverage/quota, and verify rejection becomes a visible conflict in the device queue.
- On a real Android browser, load the app online, collect within the active session offline, reconnect and explicitly synchronize. Check service-worker updates between deployments.
- Verify consent declines retain no demographic data and sample groups below the minimum are suppressed.

These hosted checks have **not** been performed in the implementation environment. No deployment URL is claimed.

## Troubleshooting

| Symptom                                | Action                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm.ps1 is blocked on Windows          | Use `npm.cmd`; no execution-policy change is necessary.                                                                                              |
| Port 5173 opens another app            | Run `npm run dev -- --port 5186`, then use the printed PublicPulse URL. Tests use 5187.                                                              |
| Blank deployment on nested URL         | Verify `_redirects` is in `dist` and Pages serves the `dist` directory.                                                                              |
| No demo entry                          | Set `VITE_DEMO_MODE=true` only for a synthetic sandbox, then restart/rebuild.                                                                        |
| Real sign-in says invalid credentials  | Confirm bootstrap ran, username mapping exists and the correct backend URL/anon key are configured. Browser demo accounts are not Supabase accounts. |
| CORS error                             | Add the exact frontend origin to `ALLOWED_ORIGINS` and redeploy the function.                                                                        |
| Function returns missing relation      | Apply the migration before provisioning accounts or deploying frontend.                                                                              |
| Surveyor has no surveys                | Check active status, password change, assignment and publication status.                                                                             |
| No geography choices                   | Import verified state/district data with valid parent IDs. Production does not seed invented codes.                                                  |
| Offline response is a conflict         | Read its error in Synchronization. Admin must resolve collection dates, quota, coverage or access before retrying. Submitted content is preserved.   |
| Refresh while offline requires sign-in | Cold-start offline authentication is not implemented. Drafts remain locally saved; sign back in online to resume.                                    |
| First-admin seeding partially fails    | The admin may already exist. Repair the reported template/dictionary seed error rather than creating a second bootstrap account.                     |
