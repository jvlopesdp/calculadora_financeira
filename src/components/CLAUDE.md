# `src/components/`

Top-level components. Conventions for the dashboard-01 shell live here.

## Layout shell

- `app-sidebar.tsx`, `site-header.tsx`, `nav-main.tsx`, `nav-user.tsx` form the shadcn `dashboard-01` shell, rendered by `src/app/app-shell.tsx`.
- Navigation links use `react-router-dom` (`<NavLink>`, `<Link>`, `useNavigate`) — NOT `next/link` or `usePathname`. When copying shadcn examples that import from `next/*`, swap them out before pasting.
- The sidebar primitive (`ui/sidebar.tsx`) ships its own `SidebarProvider`, `useSidebar` hook, `--sidebar-width` CSS var, and `Ctrl/Cmd+B` keyboard toggle. `useIsMobile()` from `src/lib/use-mobile.ts` decides between the persistent rail and the Sheet-backed drawer.
- `NavUser` reads `useCurrentUser()`: anonymous → "Entrar" button → `/login`; authed → avatar + dropdown with sign-out (calls `authClient.signOut()` then redirects to `/login`).
- `SiteHeader` renders the current page title as the page `h1`, derived from the route by `getPageTitle(pathname)` (exported so tests can verify the routing table directly). When adding a new top-level route under `<AppShell>`, extend `getPageTitle` and the parameterised `site-header.test.tsx` table.

## Testing patterns

- **Radix portal/popper components (DropdownMenu, Popover, Select, etc.) in jsdom**: mock the `@/components/ui/<name>` wrapper module with passthrough components and replace `Item` with a plain `<button role="menuitem" onClick={() => onSelect?.()}>`. This avoids the pointer-capture / portal stubbing dance and lets `fireEvent.click(screen.getByRole("menuitem", {name}))` exercise the handler deterministically. See `nav-user.test.tsx` for the canonical pattern.
- **Always use `fireEvent` from `@testing-library/react`**, never `@testing-library/user-event` (not a project dep).
- Tests that render anything under `<SidebarProvider>` need the `window.matchMedia` stub — copy the helper from `app-sidebar.test.tsx`.
- `AppSidebar` filters the nav items by `useCurrentUser()`: the `Histórico` item is hidden for anonymous users. The upstream `dashboard-01` extra sections (`navDocuments`, `navSecondary`) are intentionally removed — only `NavMain` is rendered.

## Auth routes bypass the shell

The shell is only mounted under the `<AppShell>` layout route in `src/app/routes.tsx`. Auth pages render under `<AuthLayout>` and never see `SidebarProvider`, so they don't need to mock it in tests.

## Block-content placeholders

`chart-area-interactive.tsx`, `data-table.tsx` are stubbed scaffolds — the upstream `dashboard-01` ships richer demos (TanStack Table + DnD-Kit + recharts). The real charts/tables for this app live under `src/features/simulator/components/*`. Future stories may swap the stubs in for KPI surfaces, but consumers should keep importing from `@/components/<name>` so the swap is local.

## SectionCards (KPI grid)

`section-cards.tsx` is the canonical KPI surface for shell pages — a responsive 1 / 2 / 4-column grid that consumes a `KpiCardData[]`. Each item has `title`, `value`, and optional `delta`, `trend` (`"up" | "down" | "neutral"`), `hint`, `icon` (Lucide). The trend controls the delta color (emerald / destructive / muted). The component renders nothing when `items` is empty.

- **No heading semantics inside cards.** Label is a `<p>`, value is a `<div>`. This is intentional: it keeps each page's section-titles (h3 on Card primitives) as the only level-3 headings, so route-level tests can keep asserting against `getAllByRole("heading", { level: 3 })`. If you ever change this, expect to update `financiamento-page.test.tsx` and similar.
- **Don't compute KPIs in the page component.** Build them in `src/features/<area>/lib/build-<area>-kpis.ts` (pure function over simulation state → `KpiCardData[]`). Pages call it inside a `useMemo` and pass the result to `<SectionCards items={…}/>`. This keeps financial logic out of the React component per the project's `core/finance` rule and makes the KPI shape unit-testable in isolation.
- **Empty-state behavior**: every KPI builder returns four items with `value: "—"` when state is missing, so the grid always renders four placeholders rather than disappearing. Use `hint` to explain why a slot is empty ("Disponível em breve", "Sem pagamento extra", etc.).
- **Test-ids are derived from titles** via a NFD-strip-diacritics + slugify pass: `kpi-card-<slug>` and `kpi-card-<slug>-value`. Stable for assertions like `getByTestId("kpi-card-parcela-base-value")`.
