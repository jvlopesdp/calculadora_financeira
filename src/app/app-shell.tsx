import { Outlet } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Placeholder shell used while the real dashboard-01 layout (sidebar + site
 * header) is not in place yet. US-013 replaces this with the shadcn dashboard
 * shell; until then it preserves the visual chrome the MVP shipped with.
 */
export function AppShell() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="bg-background/95 border-border supports-[backdrop-filter]:bg-background/75 sticky top-0 z-40 border-b shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 py-4 md:px-6">
          <h1 className="font-serif text-xl font-bold md:text-2xl">
            Simulador de Financiamento
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-4 py-8 md:px-6 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
