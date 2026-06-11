import {
  IconCalculator,
  IconReceipt2,
  IconScale,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { BrandLogo } from "@/components/brand/brand-logo";
import { BrandMark } from "@/components/brand/brand-mark";
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

const baseNavMain: NavMainItem[] = [
  { title: "Financiamento", url: "/financiamento", icon: IconCalculator },
  {
    title: "Meus Financiamentos",
    url: "/meus-financiamentos",
    icon: IconReceipt2,
  },
  { title: "Alugar x Financiar", url: "/alugar-x-financiar", icon: IconScale },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/financiamento">
                <BrandLogo
                  className="h-8 w-auto"
                  containerClassName="hidden md:inline-flex"
                />
                <BrandMark className="h-8 w-auto md:hidden" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={baseNavMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
