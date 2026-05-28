# `src/components/`

Top-level components. Conventions for the dashboard-01 shell live here.

## Layout shell

- `app-sidebar.tsx`, `site-header.tsx`, `nav-main.tsx`, `nav-user.tsx` form the shadcn `dashboard-01` shell, rendered by `src/app/app-shell.tsx`.
- Navigation links use `react-router-dom` (`<NavLink>`, `<Link>`, `useNavigate`) — NOT `next/link` or `usePathname`. When copying shadcn examples that import from `next/*`, swap them out before pasting.
- The sidebar primitive (`ui/sidebar.tsx`) ships its own `SidebarProvider`, `useSidebar` hook, `--sidebar-width` CSS var, and `Ctrl/Cmd+B` keyboard toggle. `useIsMobile()` from `src/lib/use-mobile.ts` decides between the persistent rail and the Sheet-backed drawer.
- `NavUser` reads `useSession()` (from `@/lib/queries/session`): anonymous → "Entrar" button → `/login`; authed → avatar + dropdown with sign-out (calls the `useSignOut()` mutation — `POST /api/auth/sign-out`, invalidates `['session']` — then redirects to `/login`).
- `SiteHeader` renders the current page title as the page `h1`, derived from the route by `getPageTitle(pathname)` (exported so tests can verify the routing table directly). When adding a new top-level route under `<AppShell>`, extend `getPageTitle` and the parameterised `site-header.test.tsx` table.

## Testing patterns

- **Radix portal/popper components (DropdownMenu, Popover, Select, etc.) in jsdom**: mock the `@/components/ui/<name>` wrapper module with passthrough components and replace `Item` with a plain `<button role="menuitem" onClick={() => onSelect?.()}>`. This avoids the pointer-capture / portal stubbing dance and lets `fireEvent.click(screen.getByRole("menuitem", {name}))` exercise the handler deterministically. See `nav-user.test.tsx` for the canonical pattern.
- **Always use `fireEvent` from `@testing-library/react`**, never `@testing-library/user-event` (not a project dep).
- Tests that render anything under `<SidebarProvider>` need the `window.matchMedia` stub — copy the helper from `app-sidebar.test.tsx`.
- `AppSidebar` filters the nav items by `useSession()`: the `Histórico` item is hidden for anonymous users. The upstream `dashboard-01` extra sections (`navDocuments`, `navSecondary`) are intentionally removed — only `NavMain` is rendered.

## Auth routes bypass the shell

The shell is only mounted under the `<AppShell>` layout route in `src/app/routes.tsx`. Auth pages render under `<AuthLayout>` and never see `SidebarProvider`, so they don't need to mock it in tests.

## Available shadcn primitives under `ui/`

Before adding a new shadcn block, grep `ui/` — most common primitives are already hand-written here: `button`, `card`, `input`, `label`, `form`, `select`, `tabs`, `separator`, `tooltip`, `sheet`, `dialog`, `alert`, `progress`, `avatar`, `dropdown-menu`, `sidebar`, `skeleton`. They follow upstream shadcn conventions (CVA variants, `cn(...)` for class merging, `data-state` selectors, forwardRef) and use `react-router-dom` instead of `next/*` where router APIs apply. `dialog`, `alert`, `progress` were added in US-030 — the Dialog is center-positioned (mirrors the Sheet primitive but with `max-w-lg`); the Progress is a plain `role="progressbar"` div (no Radix dependency).

## DataTable

`data-table.tsx` is the canonical generic table surface for the app. Typed `DataTable<TRow>` with `columns: DataTableColumn<TRow>[]`, `data: TRow[]`, `pageSize?: 12 | 24`. No drag-and-drop, no external table library — the upstream `dashboard-01` TanStack/DnD demo was deliberately replaced (US-024).

- Each column declares `id`, `header`, optional `numeric`, optional `sortable` + `sortValue: (row) => number`, and a required `cell: (row) => ReactNode`. Sortable columns must also provide `sortValue` — otherwise the sort button no-ops.
- Numeric columns are right-aligned and rendered with the `font-tabular` utility (`src/index.css`). Use them for any monetary or count column for legibility.
- Sort cycle on a sortable header: `none → asc → desc → none`. `aria-sort` is set per state so accessibility-tree tests can assert direction.
- Pagination is client-side. Internal state is `useState(0)`; the table self-clamps if the current page exceeds the new last page after `data` shrinks. Prev/Next buttons disable at the boundaries.
- The empty state is a single `<p data-testid="data-table-empty-state">` — callers should NOT pre-check `data.length === 0` and render their own placeholder, just let DataTable handle it (or wrap with their own empty state above when the dataset semantics need explanation).
- `ariaLabel` / `ariaLabelledBy` are passed through to the `<table>` element. Prefer `ariaLabelledBy` pointing at the surrounding CardTitle's `id`.
- Domain tables (e.g. `features/simulator/components/amortization-table.tsx`) wrap `DataTable` in a Card and own scenario/filter chrome above the table. Keep financial logic out of `DataTable` — it's pure presentation over a `TRow[]`.

## ChartAreaInteractive

`chart-area-interactive.tsx` is the canonical multi-series chart surface for shell pages. Generic Card wrapper around recharts `LineChart`/`AreaChart` with:

- `views: ChartView[]` — each view has `id`, `label`, `data: ChartPoint[]`, `series: SeriesData[]`, optional `kind` (`"line" | "area"`), `description`, `emptyState`. When `views.length > 1`, a `Tabs`-based view selector is rendered; with one view, no tabs appear.
- `defaultView?: string`, `defaultRange?: "1y" | "5y" | "all"`.
- Built-in time-range toggle (1 ano / 5 anos / Total) in the CardHeader; slices `data` by `month <= bound`.
- Tooltip is `ChartAreaTooltipContent`: `Mês N · {formatMonths}` header and per-series `{name} · {formatBRL}` rows with the series colour swatch. Always pt-BR.
- Series `color` is a CSS token (`"var(--chart-1)"` … `"var(--chart-5)"`) so light/dark themes work via tokens in `src/index.css`.
- `ChartPoint` is intentionally minimal (`{ month: number }`); concrete data types from `src/features/simulator/components/charts/*-data.ts` flow through as structural subtypes. Keep the engine calls in the `*-data.ts` builders — `ChartAreaInteractive` is pure presentation.
- Stacked area composition: set `kind: "area"` + give two series the same `stackId`. The default `fillOpacity` is `0.5`.

**Don't reintroduce per-chart components.** The old `OutstandingBalanceChart`, `NetWorthChart`, `InstallmentCompositionChart`, `InterestSavingsChart` were collapsed into this one shell in US-023. New chart needs become a `ChartView` entry, not a new file under `features/simulator/components/charts/`.

## SectionCards (KPI grid)

`section-cards.tsx` is the canonical KPI surface for shell pages — a responsive 1 / 2 / 4-column grid that consumes a `KpiCardData[]`. Each item has `title`, `value`, and optional `delta`, `trend` (`"up" | "down" | "neutral"`), `hint`, `icon` (Lucide). The trend controls the delta color (emerald / destructive / muted). The component renders nothing when `items` is empty.

- **No heading semantics inside cards.** Label is a `<p>`, value is a `<div>`. This is intentional: it keeps each page's section-titles (h3 on Card primitives) as the only level-3 headings, so route-level tests can keep asserting against `getAllByRole("heading", { level: 3 })`. If you ever change this, expect to update `financiamento-page.test.tsx` and similar.
- **Don't compute KPIs in the page component.** Build them in `src/features/<area>/lib/build-<area>-kpis.ts` (pure function over simulation state → `KpiCardData[]`). Pages call it inside a `useMemo` and pass the result to `<SectionCards items={…}/>`. This keeps financial logic out of the React component per the project's `core/finance` rule and makes the KPI shape unit-testable in isolation.
- **Empty-state behavior**: every KPI builder returns four items with `value: "—"` when state is missing, so the grid always renders four placeholders rather than disappearing. Use `hint` to explain why a slot is empty ("Disponível em breve", "Sem pagamento extra", etc.).
- **Test-ids are derived from titles** via a NFD-strip-diacritics + slugify pass: `kpi-card-<slug>` and `kpi-card-<slug>-value`. Stable for assertions like `getByTestId("kpi-card-parcela-base-value")`.
