"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  AlarmClock,
  Building2,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, clearToken, User } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projektek", icon: ClipboardList },
  { href: "/prep-center", label: "Előkészítési központ", icon: AlarmClock },
  { href: "/my-tasks", label: "Saját feladatok", icon: CheckSquare },
];

const ADMIN_NAV = [{ href: "/users", label: "Felhasználók", icon: Users }];

const MANAGEMENT_NAV = [{ href: "/audit-log", label: "Audit napló", icon: ShieldCheck }];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Projektmenedzser",
  management: "Menedzsment",
  procurement: "Beszerzés",
  billing: "Számlázás",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => router.push("/login"));
  }, [router]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  const navItems = [
    ...NAV,
    ...(user?.role === "admin" ? ADMIN_NAV : []),
    ...(user?.role === "admin" || user?.role === "management" ? MANAGEMENT_NAV : []),
  ];

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
              <Building2 className="size-4" />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-base font-bold tracking-tight text-white">PLANora</span>
              <span className="text-xs text-violet-300">Projektütemező</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className="data-active:bg-gradient-to-r data-active:from-violet-600 data-active:to-fuchsia-600 data-active:text-white data-active:shadow-sm"
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        {user && (
          <SidebarFooter>
            <div className="flex items-center gap-2 rounded-lg px-1 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar size="sm">
                <AvatarFallback className="bg-violet-800 text-xs font-semibold text-violet-100">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium text-white">{user.full_name}</span>
                <Badge
                  variant="secondary"
                  className="w-fit bg-violet-900 text-[10px] text-violet-200"
                >
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                title="Kijelentkezés"
                className="shrink-0 text-violet-200 hover:bg-violet-900 hover:text-white group-data-[collapsible=icon]:hidden"
              >
                <LogOut />
              </Button>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">PLANora</span>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
