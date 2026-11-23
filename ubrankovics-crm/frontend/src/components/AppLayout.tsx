"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Building2, CheckSquare, Home, LogOut, Search, Target, UserCog, Users, Wallet, Wrench } from "lucide-react";
import { api, clearTokens, isLoggedIn, UserResponse } from "@/lib/api";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/NotificationBell";

const NAV = [
  { href: "/", label: "Kezdőlap", icon: Home },
  { href: "/erdeklodok", label: "Érdeklődők", icon: Target },
  { href: "/ugyfelek", label: "Ügyfelek", icon: Users },
  { href: "/projektek", label: "Projektek", icon: Building2 },
  { href: "/feladatok", label: "Feladatok", icon: CheckSquare },
  { href: "/penzugy", label: "Pénzügy", icon: Wallet },
  { href: "/riportok", label: "Riportok", icon: BarChart3 },
  { href: "/torzsadatok", label: "Törzsadatok", icon: Wrench },
];

const ADMIN_NAV = [{ href: "/felhasznalok", label: "Felhasználók", icon: UserCog }];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex min-h-screen w-60 flex-col justify-between bg-[var(--sidebar)] py-4 text-[var(--sidebar-foreground)]">
        <div>
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
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
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
            className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[var(--sidebar-hover)]"
          >
            <LogOut size={16} />
            Kijelentkezés
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
      {searchOpen && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}
