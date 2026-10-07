import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  History,
  Settings,
  LogOut,
  GitCompare,
} from "lucide-react";

import veritasLogo from "@/assets/veritas-logo.png";
import veritasWordmark from "@/assets/veritas-wordmark.png";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { supabaseExternal } from "@/integrations/supabase-external/client";
import { useAuth } from "@/hooks/use-auth";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Nouvelle analyse", url: "/upload", icon: Upload },
  { title: "Comparer", url: "/compare", icon: GitCompare },
  { title: "Historique", url: "/history", icon: History },
];

const settingsItems = [
  { title: "Paramètres", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    try {
      await supabaseExternal.auth.signOut();
    } catch {
      // base externe non configurée
    }
    window.location.href = "/login";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          {collapsed ? (
            <img
              src={veritasLogo}
              alt="Logo VERITAS"
              width={32}
              height={32}
              className="h-9 w-9 shrink-0 object-contain"
            />
          ) : (
            <img
              src={veritasWordmark}
              alt="Logo VERITAS"
              width={168}
              height={56}
              className="h-11 w-auto shrink-0 object-contain"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Analyse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} aria-label={item.title} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Compte</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} aria-label={item.title} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2">
          {!collapsed && user && (
            <div className="mb-2 px-2 text-xs">
              <div className="truncate font-medium text-sidebar-foreground">
                {user.email}
              </div>
              <div className="font-mono-display text-[10px] uppercase tracking-wider text-muted-foreground">
                Analyste
              </div>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Déconnexion" aria-label="Déconnexion">
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Déconnexion</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
