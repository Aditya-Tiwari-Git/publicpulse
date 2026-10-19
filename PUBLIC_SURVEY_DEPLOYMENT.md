# Public surveys and verified geography

The enhancement stays within the current React/Vite, Supabase Auth, Postgres, and Edge Function architecture. The default India template is now a short bilingual draft with conditional follow-ups. Publishing still writes immutable version snapshots; changing the draft does not rewrite earlier versions or responses. The current representative question is optional free text, and original text is retained as entered. No names or political parties are seeded.

## Apply and deploy

1. Back up the database and test on staging first. For a linked Supabase project, use `supabase db dump --linked -f publicpulse-before-public-links.sql` and store the backup securely.
2. Apply the additive migration with `supabase db push`. `202610190002_public_links.sql` makes historical responses surveyor-sourced by default, adds nullable account attribution for anonymous rows, and creates the hashed-token public-link table and restricted submit RPC. It does not drop existing data.
3. Deploy the Edge Function with the current exact frontend origin in `ALLOWED_ORIGINS`: `supabase functions deploy api --no-verify-jwt`. The function remains public at the transport layer for sign-in and public survey actions; all administrator operations still require a verified active administrator.
4. Build and deploy the frontend to a staging Pages project first. Set only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_DEMO_MODE=false` as frontend build variables. The service-role key belongs only in Supabase or a trusted local import terminal.
5. In staging, publish a survey, create a public link, scan its QR code, submit a test response, expire/deactivate the link, and verify the recorded source and per-link response count. Then repeat the same migration, function, and frontend steps in the production change window.

Do not run the production migration or deploy production code automatically from this workspace. The existing deployment and CORS configuration remain documented in [DEPLOYMENT.md](DEPLOYMENT.md).

## Public link behavior

In **Surveys → Create public link**, select an already published survey, set an optional expiry, and create a link. The browser generates 256 random bits; the Edge Function hashes the token and stores only the hash. The raw URL is shown once, with copy, preview, and downloadable QR controls. The QR adds `source=qr` so analytics can distinguish scans from typed/shared links. Each response points to the exact published version and its link record.

The anonymous path collects no name or phone number by default. Turning off anonymous responses causes the link to reject submissions; respondent accounts are not part of this release. A public respondent can submit repeatedly from different devices or networks. Rate limits slow automated retries but do not prove one-person-one-response. The API validates consent, branching, required values, allowed question keys, and state/district hierarchy before the database checks active link, expiry, version, and survey status again.

## Geography import

No Delhi, Rajasthan, Uttar Pradesh district or constituency records are bundled. Official pages available at handoff use different update cycles (and Delhi pages surfaced differing district counts), so importing a guessed or stale list would be unsafe. The workspace must obtain a source-dated official CSV/JSON before collection. Use current pages such as the [Delhi Revenue Department](https://revenue.delhi.gov.in/revenue/find-sub-divisiondistrict-0), [Delhi ECI election information](https://www.eci.gov.in/election-details/2025/U05/3), [Rajasthan government district directory](https://rajasthan.gov.in/pages/district/state-contact-directory/30905), [Rajasthan Board of Revenue district references](https://landrevenue.rajasthan.gov.in/content/landrevenuenew/en/board-of-revenue-for-raj-dep/documents/informations-related-to-district-SDM-tehsil-sub-tehsil.html), and the [Election Commission of India](https://www.eci.gov.in/) delimitation/election pages. Verify the exact publication date and geography level before importing. Keep Delhi NCT represented as a Union Territory, distinct from the two states.

CSV columns: `id,name,level,parent_id,parent_code,code`. Use stable IDs when you already have them; otherwise the importer matches existing codes or names and preserves matching database IDs. New children need a parent ID or a parent code present in the database/import. Valid levels are `country,state,district,constituency,locality,ward`.

For CSV, set provenance flags and review the generated report before importing:

```powershell
node scripts/import-geography.mjs .\verified-geography.csv `
  --source="Official department/export name" `
  --source-url="https://revenue.delhi.gov.in/revenue/find-sub-divisiondistrict-0" `
  --source-date=YYYY-MM-DD `
  --expect="Delhi NCT,Rajasthan,Uttar Pradesh" `
  --dry-run
```

Replace the sample URL and `YYYY-MM-DD` with the official source used and its publication date. Remove `--dry-run` only after reviewing the report and setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the trusted terminal. Do not put the service key in `.env` used by Vite or commit any key. Use `--report=path.json` to choose the report filename. JSON accepts the same `source`, `source_url`, `source_date`, `expected_coverage` arrays (`states`, `districts`, `constituencies`) and `records` fields. The report contains imported, rejected, duplicate, and missing-coverage information. If district or constituency expected names are not supplied, the report explicitly marks that level as not assessed.

The importer is additive and idempotent for matched existing codes/names. It does not delete records absent from a later source. Review duplicate/rejected rows and retain each generated report with the source file. Update the hierarchy through Geography if a locality/ward needs correction.

## Rollback

If public collection has a problem, deactivate the affected links in Surveys immediately. Roll back the frontend to the last known-good Cloudflare Pages deployment and redeploy the prior Edge Function revision from source control. Keep migration `202610190002_public_links.sql` and all public responses in place; do not drop its columns/tables as a rollback, because they now hold response source and audit history. Older application code can continue reading responses because historical rows have a default source and their surveyor IDs are unchanged. Restore the database backup only for database corruption after reviewing the impact on responses created since that backup.

## Remaining configuration

- Official geography data still needs to be sourced, reviewed, imported, and checked for complete district and Assembly constituency coverage.
- Public response collection supports anonymous links only. Authenticated public respondents and the optional administrator-managed representative list are not implemented.
- No respondent name or phone field is included by default. The application does not yet isolate administrator-added personal identifiers from other response answers; avoid adding those fields to public surveys until a separate restricted store and access policy are implemented.
- Analytics preserves and counts representative free-text answers as entered. It does not normalize spellings or assert that variants refer to the same person.
- SMS, WhatsApp, and IVR collection are not implemented.
