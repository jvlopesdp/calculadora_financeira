# `src/components/`

Top-level components. Conventions for the dashboard-01 shell live here.

## Layout shell

- `app-sidebar.tsx`, `site-header.tsx`, `nav-main.tsx`, `nav-user.tsx` form the shadcn `dashboard-01` shell, rendered by `src/app/app-shell.tsx`.
- Navigation links use `react-router-dom` (`<NavLink>`, `<Link>`, `useNavigate`) — NOT `next/link` or `usePathname`. When copying shadcn examples that import from `next/*`, swap them out before pasting.
- The sidebar primitive (`ui/sidebar.tsx`) ships its own `SidebarProvider`, `useSidebar` hook, `--sidebar-width` CSS var, and `Ctrl/Cmd+B` keyboard toggle. `useIsMobile()` from `src/lib/use-mobile.ts` decides between the persistent rail and the Sheet-backed drawer.
- `NavUser` reads `useCurrentUser()`: anonymous → "Entrar" button → `/login`; authed → avatar + dropdown with sign-out (calls `authClient.signOut()` then redirects to `/login`).
- `AppSidebar` filters the nav items by `useCurrentUser()`: the `Histórico` item is hidden for anonymous users. The upstream `dashboard-01` extra sections (`navDocuments`, `navSecondary`) are intentionally removed — only `NavMain` is rendered.

## Auth routes bypass the shell

The shell is only mounted under the `<AppShell>` layout route in `src/app/routes.tsx`. Auth pages render under `<AuthLayout>` and never see `SidebarProvider`, so they don't need to mock it in tests.

## Block-content placeholders

`section-cards.tsx`, `chart-area-interactive.tsx`, `data-table.tsx` are stubbed scaffolds — the upstream `dashboard-01` ships richer demos (TanStack Table + DnD-Kit + recharts). The real charts/tables for this app live under `src/features/simulator/components/*`. Future stories may swap the stubs in for KPI surfaces, but consumers should keep importing from `@/components/<name>` so the swap is local.
