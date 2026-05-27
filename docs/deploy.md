# Deploy & Operations

This document covers everything needed to bring a fresh Cloudflare account up
to a working production deployment of `calculadorafinanceira.app`, plus the
day-to-day procedures used to operate it (deploys, DNS, secrets, backups,
smoke tests).

The deploy pipeline itself lives in
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) and runs on
every push to `main`. The PR gate lives in
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and must be green
before merge.

---

## 1. Initial setup (one-time per account)

These steps create the Cloudflare resources the deployed Worker needs. Run
them once when standing up a new environment.

### 1.1 Create the D1 database

```sh
bunx --bun wrangler d1 create calculadora-financeira-db
```

Wrangler prints something like:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "calculadora-financeira-db",
      "database_id": "<generated-uuid>"
    }
  ]
}
```

Copy the `database_id` into [`wrangler.jsonc`](../wrangler.jsonc) — replacing
the placeholder `00000000-0000-0000-0000-000000000000`. Commit the change.

### 1.2 Apply migrations to the new database

```sh
# Local emulated D1 (used by `bun run dev:worker`)
bun run db:migrate:local

# Remote (production)
bun run db:migrate:remote
```

Both scripts ultimately call `bunx --bun wrangler d1 migrations apply
calculadora-financeira-db --local|--remote`. See
[`docs/schema.md`](./schema.md) for the table layout each migration creates.

### 1.3 Configure `wrangler.jsonc`

The committed [`wrangler.jsonc`](../wrangler.jsonc) is the source of truth for
bindings (`DB`, `ASSETS`), vars (`EMAIL_FROM`, `ENVIRONMENT`), the custom
domain route, and `observability.enabled` (logs in the Cloudflare dashboard).
If you fork the project for a different environment, edit:

- `name` — the Worker script name
- `vars.EMAIL_FROM` — the sender address Resend will use
- `routes[].pattern` — the custom domain bound to the Worker
- `d1_databases[0].database_id` — the new D1 database ID from step 1.1

### 1.4 Push secrets to the Worker

Secrets are not stored in `wrangler.jsonc`. Use:

```sh
bunx --bun wrangler secret put BETTER_AUTH_SECRET
bunx --bun wrangler secret put RESEND_API_KEY
bunx --bun wrangler secret put TURNSTILE_SECRET_KEY
```

Each command prompts for the value and stores it encrypted on Cloudflare.
The full list of required env vars (with descriptions) is in
[`.env.example`](../.env.example).

---

## 2. DNS — point `calculadorafinanceira.app` to the Worker

The Worker is bound via `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "calculadorafinanceira.app", "custom_domain": true }
]
```

**`custom_domain: true` means Cloudflare creates the route binding directly —
you do NOT need a separate `A` or `CNAME` record.** Wildcards and paths are
not accepted for custom domains; the bare hostname is the only valid form.

### 2.1 First-time domain setup

1. Add the zone `calculadorafinanceira.app` to your Cloudflare account
   (**Websites → Add a site**).
2. Cloudflare gives you two nameservers. Set them at the domain registrar
   (e.g. NS records for `*.cloudflare.com`).
3. Wait for the zone to show **Active** in the dashboard. From this point on
   the Cloudflare API token has authority to create the custom-domain route
   on `wrangler deploy`.
4. Run `bun run deploy`. Wrangler attaches the Worker to the zone and
   provisions the TLS certificate (cert is automatic; no manual action).

### 2.2 Verifying

```sh
dig +short NS calculadorafinanceira.app
# → should match the nameservers shown in the Cloudflare dashboard

curl -I https://calculadorafinanceira.app
# → HTTP/2 200, served by Cloudflare
```

---

## 3. Resend — transactional email

Resend powers verification e-mails and password resets. The integration is
the standard one (HTTPS API + `EMAIL_FROM`), so the only Cloudflare-specific
work is verifying the domain DNS in Cloudflare.

### 3.1 Verify the sending domain

1. In Resend, **Domains → Add Domain** and add
   `calculadorafinanceira.app`.
2. Resend shows DKIM (CNAME) and SPF (TXT) records plus an optional DMARC.
3. In **Cloudflare DNS** for that zone, add the records exactly as Resend
   prints them. They typically look like:

   | Type  | Name                              | Content                                  |
   | ----- | --------------------------------- | ---------------------------------------- |
   | CNAME | `resend._domainkey`               | `resend._domainkey.resend.com.`          |
   | TXT   | `@`                               | `v=spf1 include:amazonses.com ~all`      |
   | TXT   | `_dmarc`                          | `v=DMARC1; p=none;` (optional)           |

4. Disable Cloudflare proxying (grey cloud) for the DKIM CNAME — Cloudflare
   must not rewrite the value.
5. Back in Resend, click **Verify**. Once it shows verified, sending works.

### 3.2 Create the API key

In Resend, **API Keys → Create API Key** with **Sending Access** scoped to
the verified domain. Store it as the `RESEND_API_KEY` Worker secret (see
step 1.4). The Worker code in [`src/server/email.ts`](../src/server/email.ts)
falls back to a console log when `RESEND_API_KEY` is empty, so local dev
without a key still works.

`EMAIL_FROM` is a `vars` entry in `wrangler.jsonc`, not a secret. Default
value: `no-reply@calculadorafinanceira.app`.

---

## 4. Cloudflare Turnstile — anti-bot on auth forms

Turnstile gates `/auth/register`, `/auth/login` and `/auth/forgot-password`.
Both keys are obtained at
<https://dash.cloudflare.com/?to=/:account/turnstile>.

### 4.1 Create a site

1. **Turnstile → Add a site**, name it (e.g. `calculadorafinanceira.app`),
   widget mode **Managed**, domain `calculadorafinanceira.app` (add
   `localhost` for local dev).
2. Save. Cloudflare shows two keys: a **site key** (public) and a **secret
   key** (server-only).

### 4.2 Wire them up

- The **site key** is `VITE_TURNSTILE_SITE_KEY` in `.env.local` for dev and
  in CI build env for production (it ends up in the bundled JS, so it's
  public anyway).
- The **secret key** is `TURNSTILE_SECRET_KEY`, pushed as a Worker secret
  (step 1.4).

Both the frontend (`src/features/auth/components/turnstile-field.tsx`) and
the Worker verifier (`src/server/turnstile.ts`) bypass Turnstile when their
respective key is empty. Keep these in sync: clearing only one of them
breaks local dev.

---

## 5. Environment variables

Full reference (with comments) lives in [`.env.example`](../.env.example).
Quick summary of where each value goes:

| Variable                  | Where it lives                                          | Notes                                                                 |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `VITE_APP_URL`            | `.env.local` (dev), CI build env (prod)                 | Public app origin. Default dev value `http://localhost:5173`.         |
| `VITE_TURNSTILE_SITE_KEY` | `.env.local` (dev), CI build env (prod)                 | Public site key. Empty value disables the widget (dev convenience).   |
| `BETTER_AUTH_URL`         | `.env.local` (dev), `vars` in `wrangler.jsonc` if fixed | Better Auth base URL — usually identical to `VITE_APP_URL`.           |
| `BETTER_AUTH_SECRET`      | Worker secret (`wrangler secret put`)                   | Generate with `openssl rand -base64 32`. NEVER commit.                |
| `RESEND_API_KEY`          | Worker secret                                           | Empty → email functions log to console instead of sending.            |
| `TURNSTILE_SECRET_KEY`    | Worker secret                                           | Empty → Worker bypasses verification (dev only).                      |
| `EMAIL_FROM`              | `vars` in `wrangler.jsonc`                              | Verified sender. Default: `no-reply@calculadorafinanceira.app`.       |
| `ENVIRONMENT`             | `vars` in `wrangler.jsonc`                              | Label echoed by `/api/health`. Default: `production`.                 |
| `CLOUDFLARE_API_TOKEN`    | **GitHub Actions secret only**                          | Used by `deploy.yml` and `db:migrate:remote`. NOT a Worker secret.    |
| `CLOUDFLARE_ACCOUNT_ID`   | **GitHub Actions secret only**                          | Same as above.                                                        |

The build also injects `__COMMIT_SHA__` at compile time from `GITHUB_SHA`
(or `"dev"` locally). It surfaces in `/api/health.version` and helps confirm
which commit is actually live after a deploy.

---

## 6. Deploy

### 6.1 Automatic (recommended)

Every push to `main` triggers
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), which:

1. Checks out the commit.
2. Installs Bun and Node 20 (wrangler requires it).
3. Caches `~/.bun/install/cache` keyed by `bun.lock`.
4. `bun install --frozen-lockfile`.
5. `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`.
6. `bunx wrangler d1 migrations apply calculadora-financeira-db --remote`.
7. `bunx wrangler deploy`.
8. Writes a job summary with the deploy URL and commit SHA.

The job runs in the `production-deploy` concurrency group with
`cancel-in-progress: false`, so a later push waits instead of cancelling an
in-flight deploy mid-migration. Fix-forward only — failed deploys are not
retried automatically.

### 6.2 Manual deploy from a workstation

Mirror the CI pipeline locally when debugging a broken deploy. You need
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exported into the shell.

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run db:migrate:remote   # bunx --bun wrangler d1 migrations apply ... --remote
bun run deploy              # bunx --bun wrangler deploy
```

`bun run deploy:dry-run` is what the PR CI runs to catch wrangler-config
errors without contacting the API.

### 6.3 Required GitHub Actions secrets

Configured in **Settings → Secrets and variables → Actions**:

| Secret                  | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token wrangler uses to apply D1 migrations and deploy the Worker.                        |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account hosting the `calculadora-financeira` Worker and D1 database.          |

Create the token via **My Profile → API Tokens → Create Custom Token** with:

- **Account** → `Workers Scripts: Edit`
- **Account** → `D1: Edit`
- **Account** → `Account Settings: Read`

Scope the token to the single account that hosts the project.

### 6.4 Post-deploy smoke test

After every deploy, hit the health endpoint and confirm the SHA matches the
commit you just deployed:

```sh
curl https://calculadorafinanceira.app/api/health
# → { "ok": true, "version": "<short-sha>", "environment": "production" }
```

If `version` is `"dev"` or stale, the build did not see `GITHUB_SHA` (check
the workflow env) or the deploy did not actually replace the Worker bundle
(check the Cloudflare dashboard for the deployment timestamp).

Beyond that, click through the golden path: load `/`, sign in, persist a
scenario, log out. The Worker logs are visible in the Cloudflare dashboard
under **Workers & Pages → calculadora-financeira → Logs** (enabled by
`observability.enabled` in `wrangler.jsonc`).

---

## 7. D1 backups

D1 has point-in-time recovery from Cloudflare's side, but we also take
periodic logical exports for offline / disaster scenarios. Run on demand
(no schedule yet — manual is fine for the current data volume):

```sh
bunx --bun wrangler d1 export calculadora-financeira-db \
  --remote \
  --output=backup-$(date +%Y-%m-%d).sql
```

The `.sql` file is a fully-replayable script:

```sh
# Restore into a fresh database (dangerous — overwrites schema)
bunx --bun wrangler d1 execute <target-db-name> --remote --file=backup-YYYY-MM-DD.sql
```

Store the backups outside the repo (encrypted bucket, password manager
attachment, etc.) — they contain user data. Don't commit them.
