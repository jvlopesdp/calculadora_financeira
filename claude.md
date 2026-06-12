# CLAUDE.md

## Project

Financial simulation app for mortgage/loan analysis. Frontend: Vite + React SPA. Backend: a single Cloudflare Worker (Hono) serving `/api/*` and the SPA assets. Authenticated users persist their tracked financings and monthly payment entries to Cloudflare D1. The deployed domain is `calculadorafinanceira.app`.

---

## Stack

- **Runtime:** Bun (local dev + scripts)
- **Frontend:** Vite + React 19 + TypeScript + React Router
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Precision:** Decimal.js
- **Export:** SheetJS/xlsx
- **Tests:** Vitest (+ Testing Library / jsdom)
- **Worker:** Cloudflare Workers + Hono (`src/server/`)
- **Database:** Cloudflare D1 (SQLite) via migrations in `migrations/`
- **Auth:** Better Auth (email/password + verification + password reset, session cookies)
- **Email:** Resend (transactional — verify e-mail, password reset)
- **Anti-bot:** Cloudflare Turnstile (sign-up / sign-in / forgot-password)
- **Deploy:** Cloudflare Workers (single worker handles API + static SPA assets) via Wrangler

---

## Code Rules

- Strict TypeScript. No `any`.
- Pure functions for all financial calculations.
- Financial logic must live in `core/finance` — never inside React components.
- Components only display and orchestrate data.
- Keep files small and focused.
- No duplicated logic. No premature abstractions.
- No new dependencies without clear justification.

---

## Project Structure

```
src/
  app/                # router chrome (BrowserRouter, AppShell, ProtectedRoute, 404)
  core/finance/       # financial calculation engine (pure, Decimal.js)
  features/
    simulator/        # main simulation UI
    acompanhamento/   # "Meus Financiamentos" — list/detail/novo + tracker UI
    account/          # account management page (/conta)
    auth/             # login, register, forgot/reset, verify-email pages
  components/ui/      # shadcn primitives
  components/finance/ # domain financial components
  lib/                # api-client, auth-client, formatters, storage, helpers
  server/             # Cloudflare Worker (Hono): /api/auth/*, /api/tracker/plans/*, /api/account, /api/drafts
    routes/           # Hono sub-apps per resource
    middleware/       # requireUser, etc.
  types/              # shared domain types
  tests/              # cross-cutting unit tests
migrations/           # D1 SQL migrations (better-auth, domain, rate-limit)
```

---

## Financial Calculations

- All calculations are deterministic and traced month by month.
- Use Decimal.js — no native float arithmetic on monetary values.
- Engine must support:
  - Base financing simulation
  - Extra monthly payments (term reduction and installment reduction)
  - Rent vs. buy comparison
  - Compound investment return
  - Property appreciation
  - Rent adjustment

---

## Naming

Use precise financial terms: `principal`, `interest`, `amortization`, `installment`, `balance`, `rate`, `term`.

---

## Validation

Validate all financial inputs before running any simulation:

- Property value > 0
- Down payment < total value
- Loan term > 0
- Interest rate valid (> 0)
- Extra payment ≥ 0
- Rent ≥ 0
- Investment return and property appreciation valid

Do not run simulations with invalid input.

---

## State

- Local React state by default for UI.
- Use derived state — do not duplicate calculated values.
- **D1 is the source of truth** for authenticated user data: tracker plans (`tracker_plans`) and their monthly payment entries (`tracker_entries`). The SPA reads/writes through `/api/tracker/plans/*` via `src/lib/api-client.ts`.
- `localStorage` is for UI preferences only (sidebar collapsed state, last unsaved simulation draft, one-time migration flags). It is **not** a substitute for D1 once the user is authenticated.
- No Zustand, Redux, or server state libraries.

---

## Testing

Every financial rule must have unit tests. Required coverage:

- PRICE installment calculation
- Amortization schedule generation
- Remaining balance
- Accumulated interest
- Extra payment: term reduction
- Extra payment: installment reduction
- Rent vs. buy comparison
- Compound investment growth
- Property appreciation and rent adjustment
- Excel export data structure

Server-side (Worker) tests live alongside the route/middleware they exercise (`src/server/**/*.test.ts`) and drive Hono via `app.request(path, init, env)` with a fake D1 — no miniflare required.

---

## Excel Export

- Fully client-side via SheetJS.
- Sheets: Summary, Assumptions, Base Financing, Financing + Extra Payment, Rent vs. Buy, Amortization Table.
- Exported data must match what is displayed in the UI.
- No separate financial logic for export — reuse the engine.

---

## CI/CD

CI runs on pull requests and `main`. Steps:

1. `bun install`
2. Type check (SPA + Worker via `tsc -b`)
3. Lint
4. Test (Vitest, all suites)
5. Build (SPA + Worker via the cloudflare/vite-plugin)
6. `wrangler deploy --dry-run` smoke

Block merge on any failure. Auto-deploy to production from `main` (`wrangler deploy`). D1 migrations are applied to remote before deploy (`bun run db:migrate:remote`).

---

## Definition of Done

A task is complete only when:

- Build passes (SPA + Worker)
- Type check passes
- Lint passes
- Tests pass
- D1 migrations applied (locally via `bun run db:migrate:local`; remote via `bun run db:migrate:remote` for the CI/deploy step)
- Financial logic remains in `core/finance`, not in components
- No unnecessary dependency added
