"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  AlarmClock,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, clearToken, ROLE_LABELS, User } from "@/lib/api";
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
  { href: "/calendar", label: "Naptár", icon: CalendarDays },
  { href: "/prep-center", label: "Előkészítési központ", icon: AlarmClock },
  { href: "/my-tasks", label: "Saját feladatok", icon: CheckSquare },
];

const ADMIN_NAV = [{ href: "/users", label: "Felhasználók", icon: Users }];

const MANAGEMENT_NAV = [{ href: "/audit-log", label: "Audit napló", icon: ShieldCheck }];

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
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-3">
            {/* Collapsed icon-only mode */}
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md group-data-[collapsible=icon]:flex hidden">
              <Building2 className="size-4.5" />
            </div>
            {/* Expanded: full logo on white bg */}
            <div className="group-data-[collapsible=icon]:hidden">
              <Image
                src="/planora-logo.png"
                alt="PLANora Projekt"
                width={152}
                height={50}
                priority
                className="rounded-lg bg-white px-2 py-1.5"
              />
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
                      className="data-active:bg-green-700 data-active:text-white data-active:shadow-sm"
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
                <AvatarFallback className="bg-green-700 text-xs font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium text-slate-100">{user.full_name}</span>
                <Badge
                  variant="secondary"
                  className="w-fit bg-slate-800 text-[10px] text-slate-300"
                >
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                title="Kijelentkezés"
                className="shrink-0 text-slate-400 hover:bg-slate-800 hover:text-white group-data-[collapsible=icon]:hidden"
              >
                <LogOut />
              </Button>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>

      <SidebarInset>
        {/* Persistent top header – visible on all screen sizes */}
        <header className="sticky top-0 z-20 flex h-13 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm">
          <SidebarTrigger className="text-slate-500 hover:text-slate-800" />
          <div className="h-5 w-px bg-slate-200" />
          <Image
            src="/planora-logo.png"
            alt="PLANora"
            width={110}
            height={36}
            className="md:hidden"
          />
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-2.5">
              <span className="hidden text-sm text-slate-500 sm:block">{user.full_name}</span>
              <Avatar size="sm">
                <AvatarFallback className="bg-green-700 text-xs font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                title="Kijelentkezés"
                className="text-slate-400 hover:bg-slate-100 hover:text-slate-800"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
