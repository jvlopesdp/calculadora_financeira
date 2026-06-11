import { useLocation, useMatch } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScenarioCombobox } from "@/features/historico/components/scenario-combobox";

export function getPageTitle(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/financiamento")) {
    return "Financiamento";
  }
  if (
    pathname.startsWith("/meus-financiamentos") ||
    pathname.startsWith("/historico") ||
    pathname.startsWith("/acompanhamento")
  ) {
    return "Meus Financiamentos";
  }
  if (pathname.startsWith("/alugar-x-financiar")) {
    return "Alugar x Financiar";
  }
  return "Calculadora Financeira";
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const scenarioDetailMatch = useMatch("/historico/:scenarioId");

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) [--header-height:--spacing(12)]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {scenarioDetailMatch ? <ScenarioCombobox /> : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
