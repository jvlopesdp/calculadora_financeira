import { Outlet } from "react-router-dom";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { MigrateLocalSimulationDialog } from "@/features/historico/components/migrate-local-simulation-dialog";

/**
 * Authenticated app shell scaffolded from the shadcn `dashboard-01` block.
 * Renders the persistent sidebar (drawer on mobile) and site header around the
 * routed `<Outlet/>`. Auth routes use `AuthLayout` and bypass this shell.
 */
export function AppShell() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
              <Outlet />
            </div>
            <MigrateLocalSimulationDialog />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
