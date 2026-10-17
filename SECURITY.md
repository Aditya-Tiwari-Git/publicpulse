# Research and security notes

Before real field collection:

- Set demo mode false, use unique admin credentials, replace temporary passwords, disable public sign-ups and configure exact allowed origins.
- Apply migrations and verify RLS in your deployed database. All sensitive public tables have RLS. Browser writes have no policies; verified Edge requests use privileged operations. Private auth mappings and login counters are not exposed through the public schema.
- Treat every service-role key as a secret. Only Edge runtime and trusted bootstrap terminals may use one. Never commit `.env` or inject service keys through Vite.
- JWTs are verified server-side. Frontend navigation is a convenience, not authorization. Account roles, activation and password-change flags come from the database. Cached tokens cannot bypass these checks on the API.
- Public login attempts are counted atomically in PostgreSQL. Confirm trusted IP forwarding in the hosted environment. Supabase's own Auth limits also apply. Counter rows should be periodically pruned if many distinct attempted usernames/IPs accumulate.
- Published snapshots and submitted answers cannot be updated through application APIs or direct authenticated writes. Submitted UUIDs are idempotency keys; altered retries are rejected. Quotas are checked inside a locked SQL transaction.
- The research collector obtains explicit consent and supports a decline. Names, contact numbers, IDs, precise GPS, party preference and inferred political beliefs are absent from the default response schema. Admin custom questions require responsible research review.
- Device IndexedDB stores answers, published-version references and queue metadata, never passwords or Auth tokens. Use secured field devices and a retention policy; drafts are not encrypted at rest by the application. Remove old local drafts through Synchronization. Browser-level storage encryption and access control are the device owner's responsibility.
- CSV exports neutralize spreadsheet formula prefixes. Raw exports require admin authorization. Share aggregates carefully; a minimum-cell suppression rule is not a formal differential-privacy guarantee and cannot prevent every inference through overlapping filters.
- Aggregate dashboards are admin workspace views with minimum sample thresholds. No public response endpoint or respondent-level leadership widget exists.
- Production audit records are generated on the server; client-submitted audit arrays are ignored. The application offers no audit-delete UI. Trusted database operators can still modify the database and must be separately controlled.
- Synthetic clearing is restricted to admins and SQL deletion is permitted only for records marked synthetic; genuine submissions are immutable in the application. Establish research retention/deletion procedures for legally required deletion through authorized database operations before production research.
- Review the required hosted checks in DEPLOYMENT.md. Local PGlite tests emulate Supabase's auth UID function and roles; they do not prove your project's deployed grants, Auth configuration or edge proxy settings.

This proof of concept does not implement MFA, device attestation, encrypted offline answer storage, audit hash chains, public collection, statistical weighting or an external messaging provider. Add organizational controls appropriate to your actual research deployment.
