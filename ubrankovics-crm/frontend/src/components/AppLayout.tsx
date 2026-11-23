"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Building2, CheckSquare, History, Home, LifeBuoy, LogOut, Mail, Menu, Search, Target, TrendingUp, UserCog, Users, Wallet, Wrench, X } from "lucide-react";
import { api, clearTokens, isLoggedIn, UserResponse } from "@/lib/api";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/NotificationBell";

const NAV = [
  { href: "/", label: "Kezdőlap", icon: Home },
  { href: "/erdeklodok", label: "Érdeklődők", icon: Target },
  { href: "/ugyfelek", label: "Ügyfelek", icon: Users },
  { href: "/projektek", label: "Projektek", icon: Building2 },
  { href: "/feladatok", label: "Feladatok", icon: CheckSquare },
  { href: "/jegyek", label: "Jegyek", icon: LifeBuoy },
  { href: "/kampanyok", label: "Kampányok", icon: Mail },
  { href: "/elorejelzes", label: "Előrejelzés", icon: TrendingUp },
  { href: "/penzugy", label: "Pénzügy", icon: Wallet },
  { href: "/riportok", label: "Riportok", icon: BarChart3 },
  { href: "/torzsadatok", label: "Törzsadatok", icon: Wrench },
];

const ADMIN_NAV = [
  { href: "/felhasznalok", label: "Felhasználók", icon: UserCog },
  { href: "/audit", label: "Auditnapló", icon: History },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    api.me().catch(() => router.push("/login")).then((u) => u && setUser(u));
  }, [router]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Mobilon az oldalsáv off-canvas fiók: útvonalváltáskor és Esc-re bezárul.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="flex min-h-dvh">
      {menuOpen && (
        <button
          type="button"
          aria-label="Menü bezárása"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}
      <aside
        id="fo-menu"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 flex-col justify-between overflow-y-auto bg-[var(--sidebar)] py-4 text-[var(--sidebar-foreground)] transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none md:static md:z-auto md:h-auto md:min-h-screen md:w-60 md:translate-x-0 md:overflow-visible md:visible ${
          menuOpen ? "translate-x-0" : "-translate-x-full invisible"
        }`}
      >
        <div>
          <div className="mb-2 flex justify-end px-4 md:hidden">
            <button
              type="button"
              aria-label="Menü bezárása"
              onClick={() => setMenuOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--sidebar-hover)]"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mb-6 px-4">
            <div className="rounded-[var(--radius)] bg-[var(--card)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ubrankovics-logo.svg" alt="Ubrankovics" className="w-full" />
            </div>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="mx-4 mb-4 flex items-center justify-between gap-2 rounded-[var(--radius)] border border-white/10 px-3 py-1.5 text-sm text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-hover)]"
          >
            <span className="flex items-center gap-2">
              <Search size={14} /> Keresés
            </span>
            <span className="text-xs opacity-60">Ctrl+K</span>
          </button>
          <div className="mb-4">
            <NotificationBell />
          </div>
          <nav className="space-y-1">
            {[...NAV, ...(user?.role === "admin" ? ADMIN_NAV : [])].map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors md:py-2 ${
                    active
                      ? "bg-[var(--sidebar-active)] font-medium text-white"
                      : "hover:bg-[var(--sidebar-hover)]"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="space-y-2 border-t border-white/10 pt-3 text-sm">
          {user && <div className="px-4">{user.full_name}</div>}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[var(--sidebar-hover)] md:py-2"
          >
            <LogOut size={16} />
            Kijelentkezés
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-[var(--sidebar)] px-2 text-[var(--sidebar-foreground)] md:hidden">
          <button
            type="button"
            aria-label="Menü megnyitása"
            aria-expanded={menuOpen}
            aria-controls="fo-menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--sidebar-hover)]"
          >
            <Menu size={22} />
          </button>
          <div className="rounded-[var(--radius-sm)] bg-[var(--card)] px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ubrankovics-logo.svg" alt="Ubrankovics" className="h-7 w-auto" />
          </div>
          <button
            type="button"
            aria-label="Keresés"
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--sidebar-hover)]"
          >
            <Search size={20} />
          </button>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
      {searchOpen && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}
