# D1 Schema

This document describes every table that lives in the Cloudflare D1 database
`calculadora-financeira-db`. Migrations are SQL files under `/migrations/` and
applied via `bun run db:migrate:local` (Wrangler against the local SQLite copy)
or `bun run db:migrate:remote` (against the real D1 instance).

## Conventions

- Identifiers are wrapped in double quotes and use **camelCase**, matching the
  output of `bunx @better-auth/cli generate` and the column names Better Auth
  reads/writes at runtime.
- `id` columns are `TEXT` primary keys (Better Auth generates string IDs).
- `date` columns hold ISO-8601 strings; Better Auth handles serialization.
- Booleans are stored as `INTEGER` (SQLite affinity, `0`/`1`).
- Foreign keys cascade on delete unless noted.

---

## `0001_better_auth.sql` — Better Auth core tables

These tables back `better-auth`'s session/user/account model. They are
**reserved by Better Auth**; do not add columns here directly — use the
`additionalFields` API in `src/server/auth-options.ts` instead.

### `user`

| Column          | Type    | Notes                                  |
| --------------- | ------- | -------------------------------------- |
| `id`            | TEXT PK | Better Auth-generated string ID        |
| `name`          | TEXT    | required                               |
| `email`         | TEXT    | required, **unique**                   |
| `emailVerified` | INTEGER | required, boolean (0/1)                |
| `image`         | TEXT    | nullable                               |
| `createdAt`     | DATE    | required                               |
| `updatedAt`     | DATE    | required                               |

### `session`

| Column      | Type    | Notes                                                    |
| ----------- | ------- | -------------------------------------------------------- |
| `id`        | TEXT PK |                                                          |
| `expiresAt` | DATE    | required                                                 |
| `token`     | TEXT    | required, **unique**                                     |
| `createdAt` | DATE    | required                                                 |
| `updatedAt` | DATE    | required                                                 |
| `ipAddress` | TEXT    | nullable                                                 |
| `userAgent` | TEXT    | nullable                                                 |
| `userId`    | TEXT    | required, FK → `user(id)` ON DELETE CASCADE              |

Index: `session_userId_idx` on `userId`.

### `account`

Stores credentials per provider (`emailAndPassword` uses `providerId =
"credential"` and writes the bcrypt hash to `password`).

| Column                  | Type    | Notes                          |
| ----------------------- | ------- | ------------------------------ |
| `id`                    | TEXT PK |                                |
| `accountId`             | TEXT    | required                       |
| `providerId`            | TEXT    | required                       |
| `userId`                | TEXT    | required, FK → `user(id)` CASCADE |
| `accessToken`           | TEXT    | nullable                       |
| `refreshToken`          | TEXT    | nullable                       |
| `idToken`               | TEXT    | nullable                       |
| `accessTokenExpiresAt`  | DATE    | nullable                       |
| `refreshTokenExpiresAt` | DATE    | nullable                       |
| `scope`                 | TEXT    | nullable                       |
| `password`              | TEXT    | nullable (bcrypt hash for credential provider) |
| `createdAt`             | DATE    | required                       |
| `updatedAt`             | DATE    | required                       |

Index: `account_userId_idx` on `userId`.

### `verification`

Used by email verification and password reset flows.

| Column       | Type    | Notes                  |
| ------------ | ------- | ---------------------- |
| `id`         | TEXT PK |                        |
| `identifier` | TEXT    | required (usually email) |
| `value`      | TEXT    | required (token)       |
| `expiresAt`  | DATE    | required               |
| `createdAt`  | DATE    | required               |
| `updatedAt`  | DATE    | required               |

Index: `verification_identifier_idx` on `identifier`.

---

## `0002_domain.sql` — App domain tables (historical)

This migration originally created the `financing_scenarios` + `payment_history`
tables. Both were dropped in `0007_drop_legacy_financing_tables.sql` after
their rows were migrated to the canonical `tracker_plans` + `tracker_entries`
schema in `0006_unify_financing_to_tracker.sql`. The migration file is kept
for historical replay only — no current code reads these tables.

---

## `0004_scenario_drafts.sql` — Simulator draft

One row per user holding the opaque JSON blob the simulator autosaves so an
authenticated user can resume an unfinished session across devices. Served by
`/api/drafts` (GET/PUT).

### `scenario_drafts`

| Column       | Type    | Notes                                       |
| ------------ | ------- | ------------------------------------------- |
| `user_id`    | TEXT PK | FK → `user(id)` ON DELETE CASCADE           |
| `payload`    | TEXT    | required, opaque JSON owned by the simulator |
| `updated_at` | INTEGER | required, Unix epoch milliseconds            |

---

## `0005_tracker.sql` — "Meus Financiamentos" tables

App-specific tables that back the unified "Meus Financiamentos" feature.
Naming convention is **snake_case** (distinct from Better Auth's camelCase).
Monetary values are stored as integer **cents** and rates as **basis points**
(1 bp = 0.01 %) so the Decimal.js engine can rebuild values without
floating-point loss.

### `tracker_plans`

One row per financing plan the user is tracking. The single source of truth
for the user's financings (post US-020).

| Column                       | Type    | Notes                                              |
| ---------------------------- | ------- | -------------------------------------------------- |
| `id`                         | TEXT PK | App-generated string ID                            |
| `user_id`                    | TEXT    | required, FK → `user(id)` ON DELETE CASCADE        |
| `name`                       | TEXT    | required                                           |
| `property_value_cents`       | INTEGER | required                                           |
| `down_payment_cents`         | INTEGER | required                                           |
| `term_months`                | INTEGER | required, original term in months                  |
| `annual_rate_bp`             | INTEGER | required, e.g. 1080 = 10.80 % a.a.                 |
| `modality`                   | TEXT    | required, `PRICE` \| `SAC` (check constraint)      |
| `start_date`                 | TEXT    | required, ISO-8601 date `YYYY-MM-DD`               |
| `target_monthly_total_cents` | INTEGER | required, fixed total used by the "Meta" curve     |
| `created_at`                 | INTEGER | required, Unix epoch milliseconds                  |
| `updated_at`                 | INTEGER | required, Unix epoch milliseconds                  |

Index: `tracker_plans_user_id_idx` on `user_id`.

### `tracker_entries`

Manual monthly payment entries applied to a tracker plan. Used by the
`buildCurves` engine to derive the "Realizado" curve from inputs + entries.

| Column              | Type    | Notes                                                                          |
| ------------------- | ------- | ------------------------------------------------------------------------------ |
| `id`                | TEXT PK |                                                                                |
| `plan_id`           | TEXT    | required, FK → `tracker_plans(id)` ON DELETE CASCADE                           |
| `month_index`       | INTEGER | required, 1-based month into the schedule                                      |
| `paid_amount_cents` | INTEGER | required                                                                       |
| `paid_at`           | TEXT    | required, `YYYY-MM-DD` — actual day the user paid                              |
| `apply_mode`        | TEXT    | required, `reduce_term` \| `reduce_installment` (check constraint)             |
| `note`              | TEXT    | nullable, free-text                                                            |
| `created_at`        | INTEGER | required, Unix epoch milliseconds                                              |

Unique: `(plan_id, month_index)` — at most one entry per scheduled month.
Index: `tracker_entries_plan_id_idx` on `(plan_id, month_index)`.

---

## `0003_rate_limit.sql` — Better Auth rate limit table

Backs `betterAuth({ rateLimit: { storage: "database" } })` for the IP-based
limits on `/sign-in/email` (10/15min) and `/sign-up/email` (5/h), and is also
reused by our custom email-based limiter (`src/server/rate-limit.ts`) for
`/request-password-reset` (3/h per email). Keys use the table's `key` column;
Better Auth writes `<ip>|<path>` and our before-hook writes
`forgot:email:<email>` to keep namespaces from colliding.

### `rateLimit`

| Column        | Type    | Notes                                            |
| ------------- | ------- | ------------------------------------------------ |
| `id`          | TEXT PK | Better Auth-generated string ID                  |
| `key`         | TEXT    | required, **unique** (limit bucket identifier)   |
| `count`       | INTEGER | required (request count within the window)      |
| `lastRequest` | INTEGER | required (epoch milliseconds of last request)   |

---

## Regenerating the Better Auth migration

```bash
bun run db:generate
```

This invokes `@better-auth/cli generate` with `auth.config.ts` (which targets
an in-memory SQLite database matching the D1 schema) and writes the result to
`migrations/0001_better_auth.sql`. The CLI requires a native SQLite binding
(`better-sqlite3` or `bun:sqlite`); if your environment can't compile native
modules, hand-edit the SQL to match the schema fields defined in
`@better-auth/core` (`getAuthTables`).
