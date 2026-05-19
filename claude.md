# CLAUDE.md

## Project

Browser-only financial simulation app for mortgage/loan analysis. No login, no backend, no remote database.

---

## Stack

- **Runtime:** Bun
- **Framework:** Vite + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + DiceUI
- **Charts:** Recharts
- **Precision:** Decimal.js
- **Export:** SheetJS/xlsx
- **Tests:** Vitest
- **Deploy:** Cloudflare Pages or Vercel

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
  core/finance/       # financial calculation engine
  features/simulator/ # main simulation UI
  components/ui/      # shadcn + DiceUI components
  components/finance/ # domain financial components
  lib/formatters/     # currency, percentage, number
  lib/storage/        # localStorage helpers
  lib/export/         # Excel export logic
  types/              # shared domain types
  tests/              # unit tests
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

- Local React state by default.
- Use derived state — do not duplicate calculated values.
- `localStorage` only for: last simulation, user preferences, optional saved scenarios.
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
2. Type check
3. Lint
4. Test
5. Build

Block merge on any failure. Auto-deploy to production from `main`. Preview deploys for PRs.

---

## Definition of Done

A task is complete only when:

- Build passes
- Type check passes
- Lint passes
- Tests pass
- Financial logic remains in `core/finance`, not in components
- No unnecessary dependency added
