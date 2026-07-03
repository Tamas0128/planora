"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  BarChart2,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Users,
} from "lucide-react";
import { api, clearToken, ROLE_LABELS, User } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  roles?: string[];
};

const NAV_PRIMARY: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/projects",    label: "Projektek",   icon: FolderOpen },
  { href: "/kanban",      label: "Kanban",      icon: LayoutGrid,    exact: true },
  { href: "/calendar",    label: "Naptár",      icon: CalendarDays },
  { href: "/my-tasks",    label: "Saját feladatok", icon: CheckSquare },
  { href: "/prep-center", label: "Előkészítés", icon: AlarmClock },
];

const NAV_SECONDARY: NavItem[] = [
  { href: "/users",             label: "Felhasználók",   icon: Users,      roles: ["admin"] },
  { href: "/audit-log",         label: "Audit napló",    icon: BarChart2,  roles: ["admin", "management"] },
  { href: "/activity-templates", label: "Ütemterv sablon", icon: ListChecks, roles: ["admin", "management"] },
];

interface AppLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  mainClassName?: string;
}

export default function AppLayout({ children, header, mainClassName }: AppLayoutProps) {
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

  const initials = user?.full_name
    ? user.full_name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  function isActive(item: Pick<NavItem, "href" | "exact">) {
    if (item.href.startsWith("#")) return false;
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const visibleSecondary = NAV_SECONDARY.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role ?? "");
  });

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r-0">

        {/* ── Logo ── */}
        <SidebarHeader>
          <div className="flex items-center px-2 py-2 group-data-[collapsible=icon]:justify-center">
            <div className="hidden group-data-[collapsible=icon]:block">
              <Image
                src="/planora-icon.png"
                alt="PLANora"
                width={32}
                height={31}
                priority
                style={{
                  filter: "invert(1) saturate(0) brightness(2)",
                  mixBlendMode: "screen",
                }}
              />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <Image
                src="/planora-logo.png"
                alt="PLANora Projekt"
                width={152}
                height={50}
                priority
                style={{
                  filter: "invert(1) saturate(0) brightness(2)",
                  mixBlendMode: "screen",
                }}
              />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Primary nav */}
          <SidebarGroup className="pt-1">
            <SidebarMenu>
              {NAV_PRIMARY.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className="h-8 text-[13px] text-white/65 hover:bg-white/10 hover:text-white data-active:bg-white/15 data-active:text-white"
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>

          {/* Divider */}
          <div className="mx-3 my-1 h-px bg-white/10 group-data-[collapsible=icon]:mx-1.5" />

          {/* Secondary nav */}
          <SidebarGroup>
            <SidebarMenu>
              {visibleSecondary.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                      className="h-8 text-[13px] text-white/65 hover:bg-white/10 hover:text-white data-active:bg-white/15 data-active:text-white"
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* ── User profile ── */}
        {user && (
          <SidebarFooter>
            <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar size="sm">
                <AvatarFallback className="bg-green-600 text-xs font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-[13px] font-medium text-white/90">{user.full_name}</span>
                <span className="text-[11px] text-white/50">{ROLE_LABELS[user.role] || user.role}</span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                title="Kijelentkezés"
                className="shrink-0 text-white/40 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden"
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>

      <SidebarInset>
        {/* Header – custom or default */}
        {header ?? (
          <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-slate-100 bg-white px-4">
            <SidebarTrigger className="text-slate-400 hover:text-slate-700" />
            <div className="h-5 w-px bg-slate-100" />
            <span className="text-sm font-semibold text-slate-700 md:hidden">PLANora</span>
            <div className="flex-1" />
            {user && (
              <div className="flex items-center gap-2.5">
                <span className="hidden text-sm text-slate-500 sm:block">{user.full_name}</span>
                <Avatar size="sm">
                  <AvatarFallback className="bg-green-700 text-xs font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={logout}
                  className="text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            )}
          </header>
        )}

        <main className={mainClassName ?? "flex-1 overflow-auto p-4"}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
