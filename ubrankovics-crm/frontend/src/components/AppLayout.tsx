"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, Search, X } from "lucide-react";
import { api, clearTokens, isLoggedIn, UserResponse } from "@/lib/api";
import GlobalSearch from "@/components/GlobalSearch";
import LabelAssociator from "@/components/LabelAssociator";
import NotificationBell from "@/components/NotificationBell";

type NavItem = { href: string; label: string; adminOnly?: boolean };
type NavSection = { id: string; label: string; href: string; prefixes: string[]; items: NavItem[] };

// A felső keret négy fő területe; az almenü az aktív terület oldalait mutatja.
// A munkavégzés a projekten belül történik (feladatok, ütemezés, naptár), a globális oldalak csak összesítők.
const SECTIONS: NavSection[] = [
  {
    id: "ertekesites",
    label: "Értékesítés",
    href: "/erdeklodok",
    prefixes: ["/erdeklodok", "/ugyfelek", "/kampanyok", "/elorejelzes"],
    items: [
      { href: "/erdeklodok", label: "Érdeklődők" },
      { href: "/ugyfelek", label: "Ügyfelek" },
      { href: "/kampanyok", label: "Kampányok" },
      { href: "/elorejelzes", label: "Előrejelzés" },
    ],
  },
  {
    id: "projektek",
    label: "Projektek",
    href: "/projektek",
    prefixes: ["/projektek", "/feladatok", "/naptar", "/jegyek"],
    items: [
      { href: "/projektek", label: "Projektek" },
      { href: "/feladatok", label: "Feladatok" },
      { href: "/naptar", label: "Naptár" },
      { href: "/jegyek", label: "Jegyek" },
    ],
  },
  {
    id: "penzugy",
    label: "Pénzügy",
    href: "/penzugy",
    prefixes: ["/penzugy", "/riportok"],
    items: [
      { href: "/penzugy", label: "Pénzügy" },
      { href: "/riportok", label: "Riportok" },
    ],
  },
  {
    id: "rendszer",
    label: "Rendszer beállítások",
    href: "/torzsadatok",
    prefixes: ["/torzsadatok", "/felhasznalok", "/audit", "/alvallalkozok", "/szemelyek"],
    items: [
      { href: "/torzsadatok", label: "Törzsadatok" },
      { href: "/alvallalkozok", label: "Alvállalkozók" },
      { href: "/felhasznalok", label: "Felhasználók", adminOnly: true },
      { href: "/audit", label: "Auditnapló", adminOnly: true },
    ],
  },
];

const matches = (pathname: string | null, prefixes: string[]) =>
  !!pathname && prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

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

  // Mobilon a menü lenyíló panel: útvonalváltáskor és Esc-re bezárul.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

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

  const isAdmin = user?.role === "admin";
  const visibleItems = (s: NavSection) => s.items.filter((it) => !it.adminOnly || isAdmin);
  const aktivSzekcio = SECTIONS.find((s) => matches(pathname, s.prefixes));
  const iconBtn =
    "flex h-11 w-11 items-center justify-center rounded-[var(--radius)] hover:bg-[var(--sidebar-hover)] md:h-9 md:w-9";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
        <div className="flex h-14 items-center gap-2 px-2 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-4">
          <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={menuOpen ? "Menü bezárása" : "Menü megnyitása"}
            aria-expanded={menuOpen}
            aria-controls="fo-menu"
            onClick={() => setMenuOpen((o) => !o)}
            className={`${iconBtn} md:hidden`}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link href="/" aria-label="Kezdőlap" className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--card)] px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ubrankovics-logo.svg" alt="" className="h-7 w-auto md:h-8" />
          </Link>
          </div>

          <nav aria-label="Főmenü" className="hidden items-center justify-center gap-1 md:flex">
            {SECTIONS.map((s) => {
              const active = aktivSzekcio?.id === s.id;
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-[var(--radius)] px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-[var(--sidebar-active)] font-medium text-white" : "hover:bg-[var(--sidebar-hover)]"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Keresés"
              className="hidden items-center gap-2 rounded-[var(--radius)] border border-white/10 px-3 py-1.5 text-sm text-[var(--sidebar-foreground)]/80 hover:bg-[var(--sidebar-hover)] md:flex"
            >
              <Search size={14} /> Keresés <span className="text-xs opacity-60">Ctrl+K</span>
            </button>
            <button type="button" aria-label="Keresés" onClick={() => setSearchOpen(true)} className={`${iconBtn} md:hidden`}>
              <Search size={20} />
            </button>
            <NotificationBell />
            {user && (
              <Link
                href="/fiok"
                aria-current={pathname === "/fiok" ? "page" : undefined}
                className="hidden rounded-[var(--radius)] px-2 py-1.5 text-sm hover:bg-[var(--sidebar-hover)] lg:block"
              >
                {user.full_name}
              </Link>
            )}
            <button type="button" onClick={logout} aria-label="Kijelentkezés" title="Kijelentkezés" className={iconBtn}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {aktivSzekcio && (
          <nav
            aria-label={`${aktivSzekcio.label} almenü`}
            className="hidden justify-center border-t border-white/10 bg-[var(--card)] px-2 text-[var(--foreground)] md:flex md:px-4"
          >
            {visibleItems(aktivSzekcio).map((it) => {
              const active = matches(pathname, [it.href]);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-2 text-sm ${
                    active ? "border-b-2 border-[var(--primary)] font-medium text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        )}

        <div
          id="fo-menu"
          hidden={!menuOpen}
          className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-white/10 pb-3 md:hidden"
        >
          <Link href="/" className="block px-4 py-3 text-sm hover:bg-[var(--sidebar-hover)]">
            Kezdőlap
          </Link>
          {SECTIONS.map((s) => (
            <div key={s.id} role="group" aria-labelledby={`nav-${s.id}`} className="mt-2">
              <p id={`nav-${s.id}`} className="px-4 pb-1 text-xs font-medium text-[var(--color-neutral-500)]">
                {s.label}
              </p>
              {visibleItems(s).map((it) => {
                const active = matches(pathname, [it.href]);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={`block px-4 py-3 text-sm ${active ? "bg-[var(--sidebar-active)] font-medium text-white" : "hover:bg-[var(--sidebar-hover)]"}`}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
          {user && (
            <Link href="/fiok" className="mt-2 block px-4 py-3 text-sm hover:bg-[var(--sidebar-hover)]">
              {user.full_name}
            </Link>
          )}
        </div>
      </header>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      <LabelAssociator />
      {searchOpen && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </div>
  );
}
