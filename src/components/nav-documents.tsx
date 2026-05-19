import { type Icon } from "@tabler/icons-react";
import { NavLink } from "react-router-dom";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface NavDocumentsItem {
  title: string;
  url: string;
  icon?: Icon;
}

export function NavDocuments({
  items,
  label = "Documentos",
}: {
  items: NavDocumentsItem[];
  label?: string;
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <NavLink to={item.url} end>
              {({ isActive }) => (
                <SidebarMenuButton asChild isActive={isActive}>
                  <span>
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                  </span>
                </SidebarMenuButton>
              )}
            </NavLink>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
