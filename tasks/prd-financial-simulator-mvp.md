# PRD: Financial Simulator MVP

## 1. Introduction / Overview

A browser-only single-page application for simulating real estate financing in Brazil, comparing early-amortization strategies, and contrasting "buy through financing" against "rent and invest." The product runs entirely client-side (no login, backend, or remote database), uses BRL (R$) and a pt-BR UI, and exports complete results to an `.xlsx` file.

The MVP targets non-technical users who want to understand the true cost of financing and make informed decisions between buying and renting + investing.

---

## 2. Goals

- Deliver a deterministic, month-by-month financial engine for **PRICE and SAC** amortization systems.
- Let users simulate two extra-payment strategies (reduce term vs. reduce installment) and view side-by-side impact.
- Provide a clear rent-vs-buy comparison with net-worth evolution over a user-defined horizon.
- Render four diagnostic charts: net worth (buy vs. rent), outstanding balance, installment composition (interest vs. amortization), accumulated interest savings.
- Export every visible result to a multi-sheet `.xlsx` file generated client-side.
- Match BRL/pt-BR formatting throughout (R$, comma decimal, dot thousands, "R$ 1.234,56").
- Maintain financial correctness with `Decimal.js` — no native float arithmetic on monetary values.
- Use the design tokens and typography defined in `/index.css` (tweakcn theme: Poppins / Libre Baskerville / IBM Plex Mono, OKLCH palette with full light + dark mode) as the single source of truth for styling.

---

## 3. User Stories

### US-001: Financial engine — PRICE installment & schedule
**Description:** As a developer, I need a pure-function PRICE calculator and amortization schedule generator so the rest of the app has a single source of truth for financing math.

**Acceptance Criteria:**
- [ ] `core/finance/price-calculator.ts` exposes `calculatePriceInstallment({ principal, monthlyRate, termMonths }) → Decimal`
- [ ] `core/finance/amortization.ts` exposes `generatePriceSchedule(...)` returning month-by-month rows: `{ month, installment, interest, amortization, balance }`
- [ ] All arithmetic uses `Decimal.js`; no `number` arithmetic on money
- [ ] Final balance after the last installment equals zero within rounding tolerance (≤ R$ 0,01)
- [ ] Unit tests cover: 360-month standard case, 1-month edge case, zero-rate edge case, balance-zero invariant
- [ ] Typecheck / lint / tests pass

### US-002: Financial engine — SAC installment & schedule
**Description:** As a developer, I need a SAC calculator so users can compare both amortization systems in the MVP.

**Acceptance Criteria:**
- [ ] `core/finance/amortization.ts` exposes `generateSacSchedule(...)` returning the same row shape as PRICE
- [ ] Monthly amortization is constant (`principal / termMonths`); installment decreases over time
- [ ] Final balance equals zero within rounding tolerance
- [ ] Unit tests cover: 360-month standard case, comparison invariant (SAC total interest < PRICE total interest for same inputs), balance-zero invariant
- [ ] Typecheck / lint / tests pass

### US-003: Financial engine — prepayment strategies
**Description:** As a developer, I need both extra-payment strategies implemented as pure functions so the simulator can compare them.

**Acceptance Criteria:**
- [ ] `core/finance/prepayment.ts` exposes `applyPrepaymentReduceTerm(...)` and `applyPrepaymentReduceInstallment(...)`
- [ ] Each function accepts a base schedule + `extraMonthly` (Decimal) and returns a new schedule plus summary metrics
- [ ] Returned metrics include: `totalPaid`, `totalInterest`, `interestSaved`, `originalTermMonths`, `newTermMonths`, `monthsReduced`
- [ ] Strategy 1 (reduce term): installment fixed, term shortens, last installment may be partial
- [ ] Strategy 2 (reduce installment): term fixed, future installments recalculated each month after extra payment
- [ ] Works for both PRICE and SAC base schedules
- [ ] Unit tests cover both strategies for both amortization systems, plus zero-extra-payment passthrough
- [ ] Typecheck / lint / tests pass

### US-004: Financial engine — rent vs. buy comparison
**Description:** As a developer, I need a rent-vs-buy calculator that produces parallel net-worth time series for both scenarios.

**Acceptance Criteria:**
- [ ] `core/finance/rent-vs-buy.ts` exposes `compareRentVsBuy(...)` returning `{ buyTimeline, rentTimeline, summary }`
- [ ] Buy timeline: monthly entries with `propertyValue`, `outstandingBalance`, `investedCapital`, `netWorth`
- [ ] Rent timeline: monthly entries with `rent`, `investedCapital`, `monthlyContribution`, `netWorth`
- [ ] Property appreciation compounded monthly from annual rate; rent adjusted annually
- [ ] Summary: `bestScenario`, `netWorthDifferenceFinal`, `breakEvenMonth | null`
- [ ] Unit tests cover: equal-outcome scenario, buy-wins scenario, rent-wins scenario, break-even detection
- [ ] Typecheck / lint / tests pass

### US-005: Input validation schemas
**Description:** As a developer, I need Zod schemas for every input form so simulations never run with invalid data.

**Acceptance Criteria:**
- [ ] `features/simulator/schemas/` contains schemas for financing inputs, prepayment inputs, rent-vs-buy inputs
- [ ] Validates: property value > 0, down payment ≥ 0 and < property value, term > 0, monthly rate > 0, extra payment ≥ 0, rent ≥ 0, investment return ≥ 0, property appreciation ≥ 0, horizon > 0
- [ ] Error messages in pt-BR
- [ ] Unit tests cover each rule (valid + invalid cases)
- [ ] Typecheck / lint / tests pass

### US-006: BRL / percentage formatters
**Description:** As a developer, I need shared formatters so currency and percentage display is consistent across UI, table, and export.

**Acceptance Criteria:**
- [ ] `lib/formatters/currency.ts` formats Decimal/number to `"R$ 1.234,56"` (pt-BR)
- [ ] `lib/formatters/percentage.ts` formats decimals to `"1,25%"` and parses inverse
- [ ] `lib/formatters/number.ts` formats integers/months with pt-BR separators
- [ ] Unit tests for each formatter (zero, large numbers, negatives, edge precision)
- [ ] Typecheck / lint / tests pass

### US-007: App shell — single-page layout with cards
**Description:** As a user, I want a clean single-page layout with clearly labeled sections so I can navigate the simulator without instructions.

**Acceptance Criteria:**
- [ ] `App.tsx` renders header, general-assumptions card, financing card, extra-payment card, rent-vs-buy card, results summary card, amortization table, charts, export button
- [ ] Sections in the order listed above; responsive on mobile (cards stack vertically below 768px)
- [ ] Light/dark mode toggle in header; preference held in component state (no persistence)
- [ ] Uses shadcn/ui Card, Tabs, Badge primitives
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-008: Financing simulation form
**Description:** As a user, I want to enter financing parameters and pick PRICE or SAC so the engine can produce a base scenario.

**Acceptance Criteria:**
- [ ] Form fields: property value, down payment, financed amount (derived, read-only), monthly rate, equivalent annual rate (derived, read-only), term in months, amortization system (PRICE/SAC select)
- [ ] Currency inputs format on blur to `"R$ 1.234,56"`; percentage inputs format to `"1,25%"`
- [ ] React Hook Form + Zod resolver; inline error messages in pt-BR
- [ ] Submit disabled while form invalid
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-009: Extra payment card with strategy tabs
**Description:** As a user, I want to enter an extra monthly payment and see both strategies (reduce term vs. reduce installment) side by side.

**Acceptance Criteria:**
- [ ] Single input for `extraMonthlyPayment` (R$); validated via Zod (≥ 0)
- [ ] Two tabs: "Reduzir prazo" and "Reduzir parcela"
- [ ] Each tab shows: interest saved, total paid, new term (months), months reduced, delta vs. base scenario
- [ ] Both strategies recompute reactively when financing inputs or extra payment change
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-010: Rent vs. buy card
**Description:** As a user, I want to enter rent and investment assumptions so I can compare buying through financing against renting and investing.

**Acceptance Criteria:**
- [ ] Form fields: monthly rent, annual rent adjustment %, monthly OR annual investment return %, annual property appreciation %, optional ownership costs (R$/mo), horizon (months or years toggle)
- [ ] Validated via Zod (all numeric ≥ 0; horizon > 0)
- [ ] Results panel shows: best scenario badge, final net worth (buy), final net worth (rent), difference, break-even month (or "Não atinge ponto de equilíbrio")
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-011: Results summary card
**Description:** As a user, I want a top-level summary card so I can see the key numbers without scrolling through tables.

**Acceptance Criteria:**
- [ ] Card displays: financed amount, base installment, total paid (base), total paid (with extra payment, selected strategy), total interest (base vs. with extra), total savings, original term, new term, months reduced
- [ ] All values formatted in BRL / pt-BR
- [ ] Updates reactively on any input change
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-012: Amortization data table
**Description:** As a user, I want to inspect the month-by-month amortization schedule with sorting, filtering, and column control.

**Acceptance Criteria:**
- [ ] DiceUI Radix Data Table renders rows from the active schedule (base / extra-term / extra-installment, switched via tab or select)
- [ ] Columns: month, base installment, interest, amortization, extra payment, total payment, remaining balance, accumulated interest, accumulated amortization, status
- [ ] Supports: pagination (default 12 rows/page), sorting on numeric columns, simple text filter on month range, column visibility toggle, toolbar actions, responsive horizontal scroll
- [ ] Monetary values right-aligned, tabular-nums font
- [ ] Same dataset feeds the Excel export
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-013: Charts — net worth, balance, composition, savings
**Description:** As a user, I want four diagnostic charts so I can visually understand each dimension of the simulation.

**Acceptance Criteria:**
- [ ] Chart 1: Recharts line chart — net worth buy vs. rent over horizon
- [ ] Chart 2: Recharts line chart — outstanding balance (base) and balance (extra payment) overlaid
- [ ] Chart 3: Recharts stacked area or bar — monthly installment broken into interest vs. amortization
- [ ] Chart 4: Recharts line chart — cumulative interest saved by extra payment over time
- [ ] All tooltips and axis labels in pt-BR with BRL formatting
- [ ] Charts resize responsively; legible in light and dark mode
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill

### US-014: Excel export
**Description:** As a user, I want to export the entire simulation to an Excel file so I can analyze and share results offline.

**Acceptance Criteria:**
- [ ] Button "Exportar Excel" generates an `.xlsx` file fully client-side via SheetJS
- [ ] File contains sheets: Resumo, Premissas, Financiamento Base, Amortização Extra (Reduzir Prazo), Amortização Extra (Reduzir Parcela), Aluguel vs Compra, Tabela Comparativa
- [ ] All numeric cells use Excel currency / percentage formats (BRL); no string-formatted values
- [ ] Exported data is identical to UI values (same engine output, no separate computation)
- [ ] Generated filename: `simulacao-financiamento-AAAA-MM-DD.xlsx`
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill (download and open file)

### US-015: Project scaffolding & CI
**Description:** As a developer, I need the Vite + React + TS + Bun project initialized with Tailwind, shadcn/ui, and CI so subsequent stories can build on a working foundation.

**Acceptance Criteria:**
- [ ] `bun create vite` with React + TS template
- [ ] Tailwind CSS v4, shadcn/ui, DiceUI installed and configured
- [ ] Decimal.js, React Hook Form, Zod, Recharts, SheetJS, Vitest, React Testing Library installed
- [ ] Folder structure matches `src/` layout in CLAUDE.md
- [ ] CI workflow runs: `bun install` → typecheck → lint → test → build
- [ ] Strict TypeScript; ESLint configured; no `any` allowed
- [ ] `bun run dev` starts the app and renders an empty shell

### US-016: Theme integration — index.css design tokens & typography
**Description:** As a user, I want the entire app to inherit the tweakcn theme defined in `/index.css` (colors, fonts, radii, shadows) so visual styling is consistent and centrally controlled, with a working light/dark mode toggle.

**Acceptance Criteria:**
- [ ] `/index.css` is imported once in `src/main.tsx` (or `src/index.css` mirrors and is imported there) — no other global stylesheet
- [ ] All shadcn/ui components reference theme tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, etc.) — no hardcoded hex / oklch in component JSX
- [ ] Fonts (`Poppins`, `Libre Baskerville`, `IBM Plex Mono`) are loaded via `@fontsource` packages (self-hosted) — not Google Fonts CDN
- [ ] `font-sans` applied to body, `font-mono` applied to all monetary/tabular cells, `font-serif` available for headings if used
- [ ] Dark mode is toggled by adding/removing the `dark` class on `<html>` (matches the `@custom-variant dark (&:is(.dark *))` rule in `index.css`); toggle lives in the header
- [ ] Initial mode follows `prefers-color-scheme` media query on first load; user toggle overrides for the session (in-memory only)
- [ ] All four charts (Recharts) use `var(--chart-1)` … `var(--chart-5)` from the theme — not arbitrary colors
- [ ] Typecheck / lint passes
- [ ] Verify in browser using dev-browser skill — both light and dark mode, all cards/table/charts legible

---

## 4. Functional Requirements

### Engine
- FR-1: The system must compute PRICE installment values using `Decimal.js` arithmetic.
- FR-2: The system must compute SAC installment values using `Decimal.js` arithmetic.
- FR-3: The system must generate a month-by-month amortization schedule for any combination of `(amortizationSystem, principal, monthlyRate, termMonths)`.
- FR-4: The system must support an "extra monthly payment — reduce term" strategy that keeps the installment fixed and shortens the schedule.
- FR-5: The system must support an "extra monthly payment — reduce installment" strategy that keeps the term fixed and recalculates future installments after each prepayment.
- FR-6: The system must compute a rent-vs-buy comparison producing parallel monthly net-worth time series for both scenarios.
- FR-7: The system must detect the break-even month between buy and rent (the first month where buy net worth ≥ rent net worth), returning `null` if none exists within the horizon.
- FR-8: All financial functions must be pure (no I/O, no global state, no React) and live under `src/core/finance/`.

### Inputs & Validation
- FR-9: The system must validate every financial input via Zod before any simulation runs.
- FR-10: Validation rules: property value > 0; down payment ≥ 0 AND < property value; term > 0; monthly rate > 0; extra payment ≥ 0; rent ≥ 0; investment return ≥ 0; property appreciation ≥ 0; horizon > 0.
- FR-11: The system must display Zod error messages in pt-BR adjacent to each invalid field.
- FR-12: The system must disable submit / recalc actions while any visible form is invalid.

### UI
- FR-13: The system must render a single-page layout with cards for general assumptions, financing, extra payment, rent-vs-buy, summary, amortization table, charts, and export.
- FR-14: All monetary values displayed must be formatted as BRL (`"R$ 1.234,56"`) using pt-BR locale.
- FR-15: All percentage values displayed must use the format `"1,25%"` (comma decimal).
- FR-16: The system must support light and dark mode. Initial mode follows `prefers-color-scheme`; a header toggle overrides for the session (in-memory only, no persistence). Mode switching is implemented by adding/removing the `dark` class on `<html>`, matching the `@custom-variant dark` rule in `/index.css`.
- FR-17: The layout must be responsive: cards stack vertically below 768px width.

### Table
- FR-18: The amortization table must use DiceUI Radix Data Table.
- FR-19: The table must include columns: month, base installment, interest, amortization, extra payment, total payment, remaining balance, accumulated interest, accumulated amortization, status.
- FR-20: The table must support pagination (default 12 rows per page), sorting on numeric columns, simple month-range filter, column visibility toggle, toolbar actions, and responsive horizontal scroll.
- FR-21: The table dataset must be the exact same object used by the Excel exporter.

### Charts
- FR-22: The system must render four Recharts charts: net worth buy vs. rent; outstanding balance base vs. with extra payment; installment composition (interest vs. amortization); accumulated interest savings.
- FR-23: All chart tooltips and axis labels must be in pt-BR with BRL formatting.

### Export
- FR-24: The system must export an `.xlsx` file fully client-side via SheetJS.
- FR-25: The export must include sheets: Resumo, Premissas, Financiamento Base, Amortização Extra (Reduzir Prazo), Amortização Extra (Reduzir Parcela), Aluguel vs Compra, Tabela Comparativa.
- FR-26: Numeric cells in the export must use Excel currency / percentage cell formats — not string-formatted values.
- FR-27: The export must use the same engine output as the UI; no parallel/duplicated financial logic.
- FR-28: The filename must be `simulacao-financiamento-AAAA-MM-DD.xlsx`.

### Persistence
- FR-29: The MVP must not persist any state — no localStorage, no sessionStorage, no cookies. Every page load starts with a fresh form.

### Quality
- FR-30: TypeScript must be strict; `any` is forbidden.
- FR-31: Every financial rule listed in CLAUDE.md (§ Testing) must have unit tests with Vitest.
- FR-32: CI must run `bun install` → typecheck → lint → test → build and block merge on any failure.

### Theming & Typography
- FR-33: All styling must derive from the theme tokens defined in `/index.css` (colors, fonts, radii, shadows). Components must use Tailwind theme classes (`bg-background`, `text-foreground`, `border-border`, `bg-card`, etc.) — no hardcoded color values in JSX or component CSS.
- FR-34: Typography must use `--font-sans` (Poppins) for general UI, `--font-mono` (IBM Plex Mono) for monetary and tabular numerics, `--font-serif` (Libre Baskerville) available for accent headings. Fonts must be self-hosted via `@fontsource` packages, not loaded from the Google Fonts CDN.
- FR-35: Recharts series must use the `--chart-1` through `--chart-5` CSS variables defined in `/index.css` — no arbitrary palette per chart.
- FR-36: `/index.css` is imported exactly once (in `src/main.tsx`). No additional global stylesheet may be introduced.

### Deployment
- FR-37: The build output must be a fully static SPA: `dist/` containing only HTML, JS, CSS, and assets. No serverless functions, no edge runtime, no environment variables required at runtime.
- FR-38: SPA fallback routing must be configured so any unknown path serves `index.html` (Cloudflare Pages: `public/_redirects` with `/* /index.html 200`; Vercel alternative: `vercel.json` rewrites).
- FR-39: The Excel export library (SheetJS) must be lazy-loaded via dynamic `import()` triggered by the export button click, not bundled in the initial chunk.
- FR-40: Production builds must pass a bundle-size sanity check: initial JS chunk (excluding lazy chunks) ≤ 300 KB gzipped.

---

## 5. Non-Goals (Out of Scope)

- **Authentication, accounts, backend, remote database** — the MVP is fully client-side and anonymous.
- **Persistence of any kind** — no localStorage, no scenario saving, no URL state, no history.
- **Multi-locale or multi-currency** — pt-BR / BRL only. No locale toggle.
- **Loan types beyond PRICE and SAC** — no Sistema Americano, no balão, no consórcio.
- **Variable / indexed rates** — interest rate is fixed for the simulation horizon.
- **Insurance, taxes, fees, IOF** — out of scope. Optional "ownership costs" in rent-vs-buy is a single flat monthly number, not itemized.
- **Income tax on investments** — investment returns are assumed net.
- **Inflation modeling** — values are nominal. Rent adjustment is the only periodic uplift modeled.
- **Multiple simultaneous extra-payment schedules** — only a single recurring monthly extra payment; no one-off prepayments, no annual lump sums.
- **PDF export, sharing links, printable views** — Excel export only.
- **Accessibility audit beyond shadcn/ui defaults** — WCAG conformance is not a checked acceptance criterion in MVP.
- **Mobile-specific UX** — responsive layout is required, but no native app, no PWA install prompt, no offline service worker.

---

## 6. Design Considerations

- **Visual language:** shadcn/ui primitives + DiceUI table, themed by the tweakcn-style CSS variables in `/index.css`. The palette is a warm off-white in light mode and a deep neutral in dark mode, with a saturated red (`oklch(0.4650 0.1470 24.9381)`) as primary. Use the theme's `chart-1` … `chart-5` tokens (warm reds/oranges) consistently across all four charts.
- **Component reuse:** Domain components under `components/finance/` (e.g., `CurrencyInput`, `PercentageInput`, `MonthlyValueBadge`) wrap shadcn/ui primitives — do not duplicate styling.
- **Typography:** `Poppins` for body / UI labels, `IBM Plex Mono` for every monetary value and tabular numeric so columns align in tables and summary cards (also pair with `font-variant-numeric: tabular-nums`). `Libre Baskerville` is available for the page title or marketing headings if desired.
- **Theme tokens are the source of truth:** Never write `#fff`, `text-red-500`, `bg-zinc-900`, or similar one-off Tailwind palette classes. Use the semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`, etc.). If a needed token is missing, add it to `/index.css` rather than hardcoding.
- **Dark mode:** Required from the start, not deferred. Test all four charts in both modes. The toggle adds/removes the `dark` class on `<html>` to match the `@custom-variant dark (&:is(.dark *))` rule.
- **Shadows & radii:** Use `--shadow-sm` / `--shadow-md` for cards and the `--radius-*` scale for rounded corners — both are defined in `/index.css`.
- **Empty state:** When inputs are incomplete, the summary/table/chart cards show pt-BR placeholders ("Preencha os dados para simular"), not empty containers.

---

## 7. Technical Considerations

### Engine
- **Decimal precision:** Standardize on `Decimal.js` everywhere money flows. Set a sensible global precision (≥ 20) and rounding mode (`ROUND_HALF_EVEN`) once in `core/finance/financial-types.ts`. Convert to `number` only at the display / export boundary.
- **Rounding policy:** Each installment is rounded to 2 decimals before being recorded in the schedule. The final installment absorbs any residual to drive balance to zero — document this in the engine README/comment.
- **Recalculation flow:** All forms are controlled. A single derived hook (`useSimulation`) takes the union of all valid inputs and produces all engine outputs (base schedule, both prepayment schedules, rent-vs-buy timelines). React renders are driven by that one source.
- **Performance:** A 360-month schedule × 4 scenarios is ~1440 rows of Decimal arithmetic. Run on every keystroke is fine; debounce only if profiling shows jank.
- **Excel cell formats:** Use SheetJS's `t: 'n'` + `z: 'R$ #,##0.00'` for currency and `z: '0.00%'` for percentages. Do not pre-format as strings.
- **Testing strategy:** Engine code under `src/core/finance/` must have unit tests with golden fixtures (known PRICE/SAC tables from a trusted source — e.g., a hand-computed 12-month example). UI components get smoke tests only.
- **No `any`:** Engine functions accept typed input objects (`FinancingInputs`, `PrepaymentInputs`, `RentVsBuyInputs`) defined in `core/finance/financial-types.ts`.

### Resolved conventions
- **Investment return input:** Canonical input is **annual** rate; convert to monthly via `(1 + annual)^(1/12) − 1` inside the engine. UI shows both fields, but only annual is editable; monthly is derived and read-only.
- **Rent adjustment timing:** Applied on the **12th month**, then every 12 months after (24, 36, …) — i.e., simulation-start anniversary, not calendar year.
- **Ownership costs in rent-vs-buy:** Treated as part of the buy scenario's monthly outflow. They **reduce the amount the buyer could otherwise invest** in any month where the rent payment is lower than (installment + ownership costs). The rent scenario invests the positive difference; if the difference is negative, no investment is made that month (no borrowing).
- **Negative net worth:** Display as a negative value (red, with `−R$` prefix). Do not floor at zero — being underwater is an important truth to surface.

### Deployment
- **Static SPA, no backend.** No env vars, no secrets, no SSR, no serverless functions. The output of `bun run build` is a `dist/` folder of static assets that any CDN can serve.
- **Target: Cloudflare Pages.** Rationale: no commercial-use restriction (Vercel Hobby prohibits commercial use), effectively unlimited bandwidth on the free tier, native Bun support, and PR preview deploys out of the box. Vercel remains a viable backup; both platforms work without app changes.
- **SPA routing fallback:** Ship a `public/_redirects` file containing `/* /index.html 200` for Cloudflare Pages. (For a Vercel deploy, add `vercel.json` with an equivalent rewrite — kept compatible so either provider can run the same build.)
- **Bundle hygiene:** Lazy-load SheetJS via dynamic `import()` triggered by the export button click. Without this, the initial bundle balloons by ~600 KB. Recharts is large too (~100 KB gzipped) — acceptable since charts are core to the UX, but verify with `bun run build --report` (or `rollup-plugin-visualizer`).
- **Fonts:** Self-host Poppins, Libre Baskerville, IBM Plex Mono via `@fontsource/*` packages. Avoids third-party requests to fonts.googleapis.com, which is faster (single origin), more private (no Google request log per page), and works identically on both providers.
- **CI:** GitHub Actions running on Bun. Same workflow drives Cloudflare Pages and Vercel preview deploys — both consume the static `dist/` output.
- **Risks:** Effectively none for a static, anonymous, no-data-collection app. Worst case is a vendor outage; the static output is portable to any other CDN (Netlify, S3+CloudFront, GitHub Pages) in minutes.

---

## 8. Success Metrics

- **Correctness:** PRICE/SAC engine matches hand-computed golden fixtures within R$ 0,01 on every row of a 360-month schedule.
- **Coverage:** Every test listed in CLAUDE.md § Testing exists and passes.
- **Performance:** A full recompute (all four engine outputs for a 360-month horizon) runs in under 50 ms on a mid-range laptop.
- **Build health:** CI green on `main`; preview deploy live for every PR.
- **Export fidelity:** Spot-check — any value visible in the UI can be located in the exported `.xlsx` and matches byte-for-byte after Excel's own rounding.

---

## 9. Open Questions

_All previously open questions have been resolved — see §7 "Resolved conventions" and §7 "Deployment" for the decisions on investment-return input, rent adjustment timing, ownership-cost treatment, negative net-worth display, and deploy target (Cloudflare Pages, with Vercel as a portable backup)._

Remaining items to confirm during implementation:

- **Bundle-size budget:** Is the 300 KB gzipped initial-chunk target (FR-40) the right number, or stricter (200 KB)? Recharts alone may push us close.
- **Font subsetting:** Do we need only Latin (lighter) or Latin Extended (covers more Portuguese diacritics)? `@fontsource/poppins` ships subsets — pick one. Latin extended
- **Chart palette legibility in dark mode:** The theme's `--chart-1` … `--chart-5` are all in the red/orange family. With four overlapping series on a single chart, may need to introduce a contrasting accent (e.g., a blue/green) — verify visually before locking in. No need to, keep on the configuration on index.css
