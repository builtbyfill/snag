# Deploying to Vercel with Supabase

Snag runs two ways from the same code:

- **Docker Compose** (`README.md` > Run it): local Postgres, screenshots on a volume. Nothing here changes it.
- **Vercel + Supabase** (this page): Postgres through Supabase's pooler, screenshots in a private Supabase Storage bucket.

The app picks Supabase Storage when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both set. On Vercel it refuses to start without them, since a function's disk doesn't outlive the request.

## 1. Supabase

Create the project at [supabase.com/dashboard](https://supabase.com/dashboard). On the form:

- **Database password:** use **Generate a password** (or any password without `@ : / # ? %`) and keep it in your password manager. You need it for both connection strings.
- **Region:** open **Need a specific region?** and pick one Vercel also has, e.g. Frankfurt (`eu-central-1`, Vercel `fra1`). Note it for the Vercel step.
- **Security:** uncheck **Enable Data API** and **Automatically expose new tables**. Snag never uses the Data API. Leave **Enable automatic RLS** unchecked: the migrations turn RLS on for every table themselves.
- **Advanced configuration:** leave the defaults.

If the form already exists without these choices, step 3 below turns the Data API off afterwards.

1. **Connection strings.** Click **Connect** at the top of the project, then:
   - **Transaction pooler** (port **6543**): this becomes `DATABASE_URL` on Vercel.
   - **Session pooler** (port **5432**): this becomes `DIRECT_URL`, used only by migrations and the seed on your machine.

   Both look like `postgresql://postgres.<project-ref>:<password>@aws-<n>-<region>.pooler.supabase.com:<port>/postgres`. Paste the password in place of `[YOUR-PASSWORD]`; if it contains any of `@ : / # ? %`, URL-encode it first (`[uri]::EscapeDataString('<password>')` in PowerShell), or pick a password without them. Don't add `?sslmode=…` (TLS comes from the certificate below). Skip the "Direct connection" (`db.<project-ref>.supabase.co`): it is IPv6-only unless you buy the IPv4 add-on.
2. **TLS.** **Database Settings** → **SSL Configuration**:
   - Turn on **Enforce SSL on incoming connections** (the database restarts briefly).
   - Download the CA certificate (a `.crt` file, e.g. `prod-ca-2021.crt`). Keep it **outside** the repository, e.g. in Downloads. Its contents become `DATABASE_SSL_CA`.
3. **Data API off.** **Integrations** → **Data API** → **Overview**: turn off **Enable Data API**. Snag never uses it, and with it off no REST endpoint answers for any table. The migrations also turn on row level security for every table (with no policies), so the tables stay closed if the API is turned back on.
4. **Bucket.** **Storage** → **New bucket**:
   - Name: `screenshots` (exactly).
   - **Public bucket**: off.
   - Restrict file size: **5 MB**. The app enforces the real limit (4 MiB = 4,194,304 bytes) before uploading; a bucket set to "4 MB" may mean 4,000,000 bytes and would refuse files the app accepts. Allowed MIME types: `image/png, image/jpeg, image/webp`.
5. **Secret key.** **Project Settings** → **API Keys**: create a **secret key** (`sb_secret_…`) named e.g. `snag-server`. This becomes `SUPABASE_SERVICE_ROLE_KEY`. A legacy `service_role` key also works, but Supabase retires those at the end of 2026. Never put this key in a `NEXT_PUBLIC_` variable or in the browser.
6. **Project URL.** `https://<project-ref>.supabase.co` (shown under **Project Settings** → **Data API**, or in **Connect**). This becomes `SUPABASE_URL`.

## 2. Migrate and seed (once, from your machine)

In a new PowerShell terminal in the project folder. Shell variables win over `.env` (Node's `loadEnvFile` never overrides them), so your local `.env` doesn't need changing.

```powershell
$env:DIRECT_URL="postgresql://postgres.<project-ref>:<db-password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres"; $env:DATABASE_SSL_CA=Get-Content -Raw "$HOME\Downloads\prod-ca-2021.crt"; npm run db:migrate
```

```powershell
$env:SUPABASE_URL="https://<project-ref>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<sb_secret_…>"; npm run seed:demo
```

Run the second in the **same terminal** as the first, so the seed also connects through `DIRECT_URL` with the certificate. The seed needs `seed/demo/images/` (`npx tsx scripts/demo-images.ts` builds it). Expected: migrate ends with "migrations applied successfully", the seed prints `Demo: 16 report(s) added` and one report link per demo project, and **Storage** → `screenshots` shows one folder per demo project.

Then close the terminal, so a later `npm run dev` in it can't reach Supabase.

Migrations only ever run this way. The app never migrates on a cold start. Later schema changes: run the first command again.

## 3. Vercel

1. **Add New** → **Project** → import the Git repository. Framework preset: **Next.js**. Build and output settings stay at their defaults.
2. **Settings** → **Functions**:
   - **Fluid Compute**: make sure it is on (the default for new projects). Without it, Hobby functions stop at 60 s, and an extraction with a retry needs up to about 125 s.
   - **Function Region**: pick the region closest to the Supabase project's region (every query crosses that distance).
3. **Settings** → **Environment Variables**: add the list in [Vercel environment variables](#vercel-environment-variables) for **Production** (and **Preview**, if you want preview deployments to work). `DATABASE_SSL_CA` is the whole certificate, pasted as several lines; without it the app refuses to connect on Vercel rather than talk to the database unencrypted.
4. **Deploy.** After the first deploy, set `APP_URL` to the production URL (`https://<project>.vercel.app`, no trailing slash) and **Redeploy**: the copied report links use it, and `https://` turns on the Secure cookie.
5. **Check it:**
   - `https://<project>.vercel.app/api/health` answers `{"ok":true}`.
   - Sign in at `/login`, open a demo client, open a screenshot full-size. The image request answers `302` to `https://<project-ref>.supabase.co/storage/v1/object/sign/screenshots/…`, a link that stops working after 10 minutes.
   - Send one report from a phone on a real project's link and watch it get extracted.
6. **Judges.** Set `DEMO_ACCESS_CODE` (16+ characters, different from `ADMIN_SECRET` and the other secrets, which the app checks) and give it out instead of your code. Afterwards, remove it and rotate `SESSION_SECRET` to end the sessions it opened.

Limits worth knowing:

- **Extraction.** It runs after the response inside the same function, with `maxDuration = 300` on the pages that start one (two model calls of up to 60 s each fit). A ticket still `pending` after 6 minutes lost its function. The dashboard marks it failed with Retry, at the next cold start or dashboard load.
- **Uploads.** The server takes up to 4 MB (Vercel's request body limit is 4.5 MB). The browser already shrinks screenshots to fit.
- **Limits across instances.** Login failures, report and follow-up rate limits, and the hourly extraction cap are counted in the database, so they hold across Vercel instances.

## 4. Back to Docker Compose

Nothing in the repository changes between the two. With the four Supabase variables empty (as in `.env.example`):

```bash
docker compose up --build -d
```

uses the local Postgres and the `uploads` volume as before. Data created on Supabase stays there. Moving it back means `pg_dump` from `DIRECT_URL` into the Compose database and downloading the bucket, which this page doesn't cover.

## Vercel environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** string, port 6543 |
| `DATABASE_SSL_CA` | contents of the downloaded CA certificate (`prod-ca-2021.crt`) |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the `sb_secret_…` key |
| `ANTHROPIC_API_KEY` | your Anthropic key (with a spend limit) |
| `ADMIN_SECRET` | your dashboard code, 16+ characters |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `IP_HASH_SECRET` | `openssl rand -base64 32`, different from the one above |
| `APP_URL` | `https://<project>.vercel.app` |
| `DEMO_ACCESS_CODE` | optional: the judges' code |
| `EXTRACTION_MODEL`, `EXTRACTION_MAX_EDGE` | optional: defaults `claude-sonnet-5-5`, `1568` |
| `DEVELOPER_NAME`, `DEVELOPER_EMAIL` | optional: shown on the client page |

Not on Vercel: `DIRECT_URL` (your machine only), `UPLOAD_DIR`, `POSTGRES_PASSWORD`, `APP_BIND` (Compose only). Vercel sets `VERCEL=1` itself.
