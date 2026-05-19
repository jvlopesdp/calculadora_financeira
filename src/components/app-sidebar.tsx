import {
  IconCalculator,
  IconChartBar,
  IconHistory,
  IconHome,
  IconInnerShadowTop,
  IconScale,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navMain = [
  { title: "Início", url: "/", icon: IconHome },
  { title: "Financiamento", url: "/financiamento", icon: IconCalculator },
  { title: "Alugar x Financiar", url: "/alugar-x-financiar", icon: IconScale },
  { title: "Histórico", url: "/historico", icon: IconHistory },
];

const navDocuments = [
  { title: "Gráficos", url: "/financiamento", icon: IconChartBar },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/financiamento">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">
                  Calculadora Financeira
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={navDocuments} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
