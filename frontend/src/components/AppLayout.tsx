"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { api, clearToken, User } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/projects", label: "Projektek", icon: "📋" },
  { href: "/prep-center", label: "Előkészítési központ", icon: "⏰" },
  { href: "/my-tasks", label: "Saját feladatok", icon: "✅" },
];

const ADMIN_NAV = [{ href: "/users", label: "Felhasználók", icon: "👤" }];

const MANAGEMENT_NAV = [{ href: "/audit-log", label: "Audit napló", icon: "🛡️" }];

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col bg-[var(--sidebar)] text-white">
        <div className="border-b border-white/10 px-5 py-6">
          <h1 className="text-xl font-bold tracking-tight">PLANora</h1>
          <p className="mt-1 text-xs text-white/50">Projektütemező</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-white/70 hover:bg-[var(--sidebar-hover)] hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="border-t border-white/10 p-4">
            <p className="truncate text-sm font-medium">{user.full_name}</p>
            <p className="truncate text-xs text-white/50">{user.role}</p>
            <button
              onClick={logout}
              className="mt-3 w-full rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              Kijelentkezés
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
