# Deploy

This project ships to Cloudflare Workers via the
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) workflow,
which runs on every push to `main` (typically a merged pull request).

The CI workflow ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) is
the gate: it runs on pull requests and pushes to any non-`main` branch and must
be green before a PR is merged. The deploy workflow then re-runs lint /
typecheck / tests / build on `main` so the deployed commit is the one that was
actually verified.

## Pipeline

The `deploy` job runs on `ubuntu-latest`, in the `production-deploy`
concurrency group with `cancel-in-progress: false` so that a later push waits
for an in-flight deploy to finish instead of cancelling it mid-migration.

Steps:

1. `actions/checkout@v4`
2. `oven-sh/setup-bun@v2` (latest)
3. `actions/setup-node@v4` (Node 20, needed by `wrangler`)
4. Cache `~/.bun/install/cache` keyed by `bun.lock`
5. `bun install --frozen-lockfile`
6. `bun run lint`
7. `bun run typecheck`
8. `bun run test`
9. `bun run build` (SPA + Worker via the cloudflare/vite-plugin)
10. `bunx wrangler d1 migrations apply calculadora-financeira-db --remote`
11. `bunx wrangler deploy`
12. Write a job summary with the deploy URL and commit SHA

If any step fails — including a migration error or a `wrangler deploy`
failure — the job is marked failed in GitHub and the deploy is not retried
automatically. Fix forward with another commit to `main`.

## Required GitHub secrets

Configure these in **Settings → Secrets and variables → Actions** on the
repository. Both are read by `wrangler` from the job's `env`.

| Secret                  | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token wrangler uses to apply D1 migrations and deploy the Worker.                    |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the `calculadora-financeira` worker and D1 database.        |

### Creating the API token

In the Cloudflare dashboard, **My Profile → API Tokens → Create Token →
Create Custom Token**, with the following permissions (all `Edit` unless
noted):

- **Account** → `Workers Scripts: Edit`
- **Account** → `D1: Edit`
- **Account** → `Account Settings: Read`

Scope it to the single account that hosts this project. Save the token value
as the `CLOUDFLARE_API_TOKEN` secret.

The account ID is shown on the right sidebar of any page in the Cloudflare
dashboard for that account; save it as `CLOUDFLARE_ACCOUNT_ID`.

## Domain

The Worker is bound to the custom domain `calculadorafinanceira.app` via
`wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "calculadorafinanceira.app", "custom_domain": true }
]
```

Custom-domain routes don't accept wildcards or paths — the bare hostname is
correct. DNS is managed inside Cloudflare for that zone; no separate A/CNAME
record is required because `custom_domain: true` creates the route binding
directly.

## Local equivalents

The same steps can be run locally (useful when debugging a failed deploy):

```sh
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run db:migrate:remote   # bunx wrangler d1 migrations apply ... --remote
bun run deploy              # bunx wrangler deploy
```

`bun run deploy:dry-run` is also available and is what the PR-time CI runs to
catch wrangler-config errors before merge.
