"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  Bell,
  BarChart2,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Search,
  Users,
} from "lucide-react";
import { api, clearToken, Notification as NotificationItem, ProjectCard, ROLE_LABELS, User } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectCard[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset, no async step needed
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      api.search(query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function handleOpenChange(next: boolean) {
    if (!next) { setQuery(""); setResults([]); }
    onOpenChange(next);
  }

  function select(project: ProjectCard) {
    handleOpenChange(false);
    router.push(`/projects/${project.id}`);
  }

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} title="Keresés" description="Projekt keresése">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Keresés projekt, ügyfél, település vagy azonosító szerint…" value={query} onValueChange={setQuery} />
        <CommandList>
          {!searching && query.trim() && results.length === 0 && (
            <CommandEmpty>Nincs találat</CommandEmpty>
          )}
          {results.length > 0 && (
            <CommandGroup heading="Projektek">
              {results.map((p) => (
                <CommandItem key={p.id} value={`${p.id}-${p.name}`} onSelect={() => select(p)}>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.project_code} · {p.settlement} · {p.client_name}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  function load() {
    api.notifications().then(setNotifications).catch(() => setNotifications([]));
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) load();
  }

  async function markRead(n: NotificationItem) {
    if (!n.read_at) {
      await api.markNotificationRead(n.id).catch(() => {});
      load();
    }
    if (n.related_project_id) {
      setOpen(false);
      router.push(`/projects/${n.related_project_id}`);
    }
  }

  async function markAllRead() {
    await api.markAllNotificationsRead().catch(() => {});
    load();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative text-slate-400 hover:bg-slate-100 hover:text-slate-700" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="text-[13px] font-semibold text-slate-800">Értesítések</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[11px] text-green-700 hover:underline">
              Mind olvasottnak jelöl
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Nincs értesítés</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                className={cn(
                  "block w-full border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50",
                  !n.read_at && "bg-blue-50/50",
                )}
              >
                <p className="text-[12px] font-medium text-slate-800">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{n.body}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(n.created_at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (user?.has_avatar) {
      api.avatarUrl(user.id).then((r) => setAvatarUrl(r.url)).catch(() => setAvatarUrl(null));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync reset, no async step needed
      setAvatarUrl(null);
    }
  }, [user?.id, user?.has_avatar]);

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const updated = await api.uploadAvatar(user.id, file);
      setUser(updated);
    } catch {
      // silently ignore — sidebar has no toast surface
    } finally {
      setAvatarUploading(false);
    }
  }

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
          <div className="flex items-center justify-center gap-1 px-2 pb-1 group-data-[collapsible=icon]:flex-col">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-7 flex-1 justify-start gap-1.5 px-2 text-[12px] text-white/50 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Search className="size-3.5 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Keresés</span>
              <span className="ml-auto text-[10px] text-white/30 group-data-[collapsible=icon]:hidden">Ctrl+K</span>
            </Button>
            <div className="[&_button]:text-white/50 [&_button:hover]:bg-white/10 [&_button:hover]:text-white">
              <NotificationBell />
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
              <input
                ref={avatarInputRef}
                type="file"
                aria-label="Profilkép feltöltése"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Profilkép módosítása"
                className="shrink-0 rounded-full disabled:opacity-50"
                disabled={avatarUploading}
              >
                <Avatar size="sm">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user.full_name} />}
                  <AvatarFallback className="bg-green-600 text-xs font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
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

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  );
}
