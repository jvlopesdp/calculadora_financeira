import {
  IconCalculator,
  IconHistory,
  IconInnerShadowTop,
  IconScale,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { NavMain, type NavMainItem } from "@/components/nav-main";
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
import { useCurrentUser } from "@/lib/use-current-user";

const baseNavMain: NavMainItem[] = [
  { title: "Financiamento", url: "/financiamento", icon: IconCalculator },
  { title: "Histórico", url: "/historico", icon: IconHistory },
  { title: "Alugar x Financiar", url: "/alugar-x-financiar", icon: IconScale },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useCurrentUser();
  const navMain = user
    ? baseNavMain
    : baseNavMain.filter((item) => item.url !== "/historico");

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
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
