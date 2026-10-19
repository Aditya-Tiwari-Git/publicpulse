# First administrator and field accounts

## Bootstrap the first real administrator

1. Create a Supabase project or start the Supabase CLI locally using Docker. Apply all committed migrations in order before running the script (`supabase db push` for a linked project, or `supabase db reset` locally).
2. In a trusted terminal, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. These are **server-side** variables, not Vite variables. Do not commit them or paste them into frontend settings.
3. For a production project, set a unique `BOOTSTRAP_USERNAME`, `BOOTSTRAP_NAME` and `BOOTSTRAP_PASSWORD` (at least 12 characters). The script rejects the known development password remotely.
4. Run `npm run seed:admin` with Node 24. The script refuses to run when an admin already exists. It creates one Supabase Auth user, a profile and private username mapping; publishes the editable India template; and initializes a small issue dictionary. It prints the username, never the password or key. No real recovery email is needed; the internal alias is a random UUID at `auth.publicpulse.invalid`.
5. Deploy the Edge Function, set allowed frontend origins, and connect the frontend. Choose Administrator, then sign in with the credentials you supplied. Change your temporary password before workspace data becomes available.
6. Import verified geography and create/assign field accounts before collection.

The script reads environment variables from the terminal, **not automatically from `.env`**. To load a local file explicitly on Node 24, use `node --env-file=.env scripts/bootstrap-admin.mjs`. Never deploy `.env` or include it in `dist`.

For local Supabase only:

```powershell
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
# Set SUPABASE_SERVICE_ROLE_KEY to the local CLI's service-role key securely.
npm.cmd run seed:admin
```

If username/password are omitted for a loopback URL, the development-only seed is:

```text
Username: admin
Password: Admin@12345
```

The first login requires replacement with a password of at least 12 characters. Do not use the local development password for public hosting. Both production and local scripts use Supabase Auth hashing; no plaintext password is written to PostgreSQL tables or IndexedDB.

**Provisioning status at handoff:** The browser demo was successfully generated and exercised. The real development Supabase seed account was **not created**, because no Supabase URL/service-role credentials or running local Supabase were available. The documented local password is a bootstrap input, not evidence of an existing Auth account.

## Additional surveyors

1. Administrator signs in and opens **Field team → Add team member**.
2. Enter name, unique assigned username and a temporary password of at least 12 characters. Choose Field surveyor.
3. Share credentials securely outside the application. The application does not email or message them.
4. Publish a survey, then open **Assignments → Assign survey**. Select the field surveyor, quota and geographic scope.
5. Surveyor chooses the Field surveyor login tab, signs in with the username and temporary password, changes the password, and sees only assigned surveys.

Deactivate a member with the power control in Field team. The backend bans the Auth account and rechecks profile activation on authenticated operations. Direct RLS reads also check activation. Reset another user's temporary password using **Reset**. Reset flags require a password change on their next operation/sign-in.

## Recovery

The login reset button acknowledges a request without revealing account existence. There is no configured SMTP or email recovery flow. Contact another administrator for a temporary password. If the only admin loses access, a trusted Supabase project owner must use the Supabase Auth administration tools to reset that user's password and set `profiles.must_change_password=true` for that user. Keep service-role access restricted; never add a public bootstrap endpoint.

The bootstrap script's account creation rolls back its Auth user if profile/mapping creation fails. Later template seeding errors can leave the administrator already created; repair the reported seeding failure manually instead of rerunning bootstrap and creating another admin.
