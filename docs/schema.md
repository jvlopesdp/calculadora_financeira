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

## `0002_domain.sql` — App domain tables

App-specific tables. Naming convention is **snake_case** (distinct from Better
Auth's camelCase) because these are our own tables and follow the conventions
in the PRD. Monetary values are stored as integer **cents** and rates as
**basis points** (1 bp = 0.01 %) so the Decimal.js engine can rebuild values
without floating-point loss.

### `financing_scenarios`

One row per financing the user is tracking. Soft-deleted via `archived_at`.

| Column                      | Type    | Notes                                              |
| --------------------------- | ------- | -------------------------------------------------- |
| `id`                        | TEXT PK | App-generated UUID/ULID                            |
| `user_id`                   | TEXT    | required, FK → `user(id)` ON DELETE CASCADE        |
| `name`                      | TEXT    | nullable (UI may default to "Financiamento #N")    |
| `property_value_cents`      | INTEGER | required, value of the property in cents           |
| `down_payment_cents`        | INTEGER | required                                           |
| `term_months`               | INTEGER | required, original term in months                  |
| `annual_rate_basis_points`  | INTEGER | required, e.g. 1080 = 10.80 % a.a.                 |
| `start_date`                | TEXT    | required, ISO-8601 date `YYYY-MM-DD`               |
| `created_at`                | INTEGER | required, Unix epoch milliseconds                  |
| `archived_at`               | INTEGER | nullable, Unix epoch ms when soft-deleted          |

Index: `idx_scenarios_user` on `user_id` — supports the per-user listing query.

### `payment_history`

Chronological record of real payments registered against a scenario. Used by
the `replayPayments` engine (US-029) to derive current state from inputs +
payments.

| Column                  | Type    | Notes                                                         |
| ----------------------- | ------- | ------------------------------------------------------------- |
| `id`                    | TEXT PK |                                                               |
| `scenario_id`           | TEXT    | required, FK → `financing_scenarios(id)` ON DELETE CASCADE    |
| `reference_month`       | TEXT    | required, `YYYY-MM` — which installment this payment maps to  |
| `payment_date`          | TEXT    | required, `YYYY-MM-DD` — actual day the user paid             |
| `amount_paid_cents`     | INTEGER | required                                                      |
| `payment_type`          | TEXT    | required, e.g. `parcela` \| `amortizacao_extra` \| `misto`    |
| `amortization_strategy` | TEXT    | required, e.g. `prazo` \| `parcela`                           |
| `notes`                 | TEXT    | nullable, free-text                                           |
| `created_at`            | INTEGER | required, Unix epoch milliseconds                             |

Index: `idx_payments_scenario_month` on `(scenario_id, reference_month)` —
supports `replayPayments` and the chronological list view.

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
