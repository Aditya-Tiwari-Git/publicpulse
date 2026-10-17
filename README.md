# PublicPulse

A responsive public-opinion research proof of concept for India. Design bilingual surveys, assign field teams, collect consented interviews, and explore privacy-protected aggregate statistics. The default survey avoids respondent names, phone numbers, precise GPS, identification numbers and political allegiance.

## Run locally

Requires **Node.js 24** and npm. On Windows with restricted PowerShell execution policies, use `npm.cmd` instead of `npm`.

```sh
npm install
cp .env.example .env
npm run dev -- --port 5186
```

PowerShell: use `Copy-Item .env.example .env` in place of `cp`.

Open the URL Vite prints (normally `http://127.0.0.1:5186`). Select **Explore admin demo** or choose **Field surveyor → Explore surveyor demo**. The explicit sandbox does not authenticate with Supabase. It seeds 864 clearly synthetic interviews into browser IndexedDB and persists edits across page reloads. Use a separate browser profile to reset the entire sandbox, or Settings to regenerate it. The configured demo flag must be **false** for a real deployment.

```sh
npm test                 # unit tests and PostgreSQL/WASM integration tests
npm run build           # TypeScript check and production bundle → dist/
npm run test:e2e         # desktop Chromium + Pixel 7 viewport workflows
npm run demo:generate -- 864
```

For browser tests, first run `npx playwright install chromium` if Chromium is not installed. E2E tests own port **5187**, refuse to reuse an existing server and explicitly run in synthetic mode. `npm run dev` does not stop other applications using port 5173; choose the printed URL or pass a free port.

## Included functionality

| Area             | Implementation                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication   | Separate admin/surveyor login experiences; Supabase Auth password hashing; server-side username mapping using random internal email aliases; active-account checks; forced password change; admin resets; account and IP attempt limits; in-memory sessions; logout |
| Authorization    | Manual JWT verification and database role lookup on authenticated Edge requests; RLS on all public data tables; no frontend service key or direct client writes                                                                                                     |
| Survey builder   | 14 question types; add, delete, duplicate, drag or button reorder; English/Hindi labels and options; defaults, ranges, selection limits, help text; conditional required fields; interactive draft preview                                                          |
| Survey lifecycle | Create, duplicate, edit, publish immutable versions, unpublish, archive; collection dates, coverage and quotas; authenticated collection links                                                                                                                      |
| Branching        | JSON AND/OR rules; ten operators; show/hide, forward skip and end actions; missing-reference, cycle and mandatory-reachability checks before publication                                                                                                            |
| Field collection | Assigned surveys; geography hierarchy; bilingual inputs; back/next; progress; autosaved IndexedDB drafts; review; consent/decline; submission confirmation; stable idempotency keys                                                                                 |
| Synchronization  | Explicit device queue; pending, conflict and synced states; manual retries; server checks current permissions, quotas and collection dates; preserves the collected version and submitted content                                                                   |
| Analytics        | Multi-select counts; severity and satisfaction; geography and demographic breakdowns; trends; missing answers; previous-period counts; cross-tabs; minimum sample suppression; CSV aggregate exports                                                                |
| Dashboard studio | KPI, bar, horizontal bar, donut, line, stacked, trend, aggregate table, severity, geography and heatmap widgets; dimensions, aggregation, per-widget filters, resize/reorder; duplicate/save/publish; global filters and CSV export                                 |
| Administration   | Field accounts; assignments; geography CSV import and hierarchy validation; configurable income bands; keyword dictionaries and classification review; read-only historical records; authorized research exports; audit events                                      |
| Deployment       | SQL migration and seed, Supabase Edge Function, secure first-admin script, Cloudflare Pages SPA redirects/headers, GitHub verification and optional deployment workflow                                                                                             |

The bilingual default **Public Opinion & Local Issues Survey — India** contains 32 questions across consent, survey context, optional demographics, civic issues, public service experience and completion. Surveyor ID and timestamps are automatic response metadata. Consent declines retain only the decline and collection metadata, not demographic answers.

## Architecture

React 18, TypeScript, Vite, Tailwind, shadcn-style Button primitives/Radix Dialog, Recharts, React Hook Form + Zod, TanStack Query, React Router and Lucide. Supabase provides PostgreSQL, authentication and privileged Edge operations. There is no paid AI dependency. The classifier is a transparent English/Hindi keyword matcher, labeled experimental and requiring admin review.

- `src/lib/engine.ts`: shared answer validation, branching and publication logic, reused by the Edge Function.
- `src/lib/api.ts`: explicit synthetic adapter or Supabase adapter. Demo credentials are never saved.
- `src/lib/storage.ts`: IndexedDB workspace sandbox and per-owner draft/queue records.
- `supabase/migrations/`: normalized tables, indexes, immutable record triggers, RLS, atomic response RPC, SQL aggregation and login rate limiter.
- `supabase/functions/api/`: authentication, user provisioning, workspace reads/writes and validated submission.
- `tests/`: engine tests and actual PostgreSQL execution through PGlite, with emulated `auth.uid()` and database roles.
- `e2e/`: browser workflows in demo mode. These do not verify hosted Supabase Auth.

SQL stores survey drafts in JSON and normalizes each published snapshot into sections, questions, options and branching rules. Responses have both their immutable answer snapshot and normalized answer rows. Geography metadata stores the deepest validated internal geographic reference ID; official codes remain optional imported reference metadata and are never invented. Normalized rows and survey snapshots commit atomically per survey; an entire multi-module workspace update is not one transaction. Response ingestion uses an advisory lock for quota and idempotency consistency.

## Real backend and hosting

Follow [ADMIN_SETUP.md](ADMIN_SETUP.md) and [DEPLOYMENT.md](DEPLOYMENT.md). Use [SECURITY.md](SECURITY.md) before collecting real interviews. Production `.env` requires `VITE_DEMO_MODE=false` plus the Supabase URL and public anon key. Never place a service-role key in any `VITE_` variable.

The **local development Supabase account** is `admin` / `Admin@12345`, created only by `npm run seed:admin` against a loopback Supabase instance. A password change is mandatory. The browser sandbox uses explicit demo entry, not that password. No actual Supabase administrator was provisioned during implementation: this workspace had no Supabase credentials or local Supabase/Docker instance.

Create additional real surveyors in **Field team → Add team member**, share the temporary credentials securely, and then use **Assignments → Assign survey**. The user must change the temporary password at first sign-in. In demo mode this creates a simulated team record only.

## Verification during implementation

Recorded checks are in [VERIFICATION.md](VERIFICATION.md). Do not interpret simulated database claims or demo browser sessions as a hosted Supabase security audit.

## Current limits and extensions

- Supabase/Cloudflare services are configured but **not provisioned or deployed** from this workspace. Live Auth, JWT gateway, deployed RLS, real device service-worker behavior and hosted Edge/database integration need the deployment smoke checks.
- Password recovery is **administrator-mediated**. The login reset action records a generic request and directs the user to their administrator; email reset delivery, SMTP and self-service recovery are not implemented. No recovery email is promised or sent.
- Auth tokens are memory-only. A fresh page load needs an online login in connected mode. Offline collection works within a loaded, signed-in session; IndexedDB drafts survive and can be resumed after signing back in. No cold-start offline authentication.
- Questionnaire labels and default option text have Hindi translations. Administrative UI and reference location names are primarily English. Locally review translations before fieldwork.
- Conditional rules and conditional-required conditions use JSON editors rather than a node-based visual branching canvas. Question reordering supports drag-and-drop and accessible buttons. Matrix defaults and advanced custom validation expressions do not have a dedicated visual editor.
- Publication detects structural cycles, invalid operators, missing targets and potentially skipped unconditional required questions. It does not formally prove satisfiability of every combination of complex conditional-required predicates; preview and review those paths before fieldwork.
- Geographic references in the sandbox use familiar place names without official codes. Production geography starts empty: import verified reference data. There is no automatic official geography dataset download or shapefile map.
- Analytics use unweighted collected responses. There is no sampling-design engine, population inference, causal claims, automated narrative insight, significance testing or weighting. Dashboard views remain authorized aggregate workspace views, not a separate public leadership portal.
- SQL offers protected question aggregation; interactive POC charts aggregate authorized records in TypeScript. Large deployments should replace full admin workspace downloads with paginated data APIs and server-side filtered aggregates. Reference/configuration lists currently use the default PostgREST page size; response reads are paginated internally.
- Multi-admin settings/layout editing uses last-write-wins semantics. Published-version conflicts and response conflicts are rejected; drafts and dashboard edits do not yet have revision-based concurrent editing.
- Consent decline is a collection outcome; completion rate is completed / (completed + declined). In-progress device drafts are excluded. Previous-period comparison compares response counts, not survey-weighted measures.
- Dashboard table widgets contain aggregate groups, not identifiable response rows. Experimental classification reviews are stored on the server and audited; the review panel currently resets its selection display on reload, and suggestions do not silently become analytical truth.
- Default values are fully represented in the survey schema; the property panel provides simple text defaults. Use valid native values for multi-select/matrix defaults through the schema when extending the builder.
- Campaign metadata is collected, but there is no separate campaign CRUD screen. End-survey rules use the source question as the cutoff; branching is question-order based.
- External SMS, WhatsApp and IVR are extension interfaces only. Provider credentials, consent processes and budgets are required before adding delivery.

No real respondent records, production passwords or service-role credentials are included.
