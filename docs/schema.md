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
