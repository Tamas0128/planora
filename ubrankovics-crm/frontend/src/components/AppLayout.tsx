"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, LogOut, Users, Wrench } from "lucide-react";
import { api, clearTokens, isLoggedIn, UserResponse } from "@/lib/api";

const NAV = [
  { href: "/ugyfelek", label: "Ügyfelek", icon: Users },
  { href: "/projektek", label: "Projektek", icon: Building2 },
  { href: "/torzsadatok", label: "Törzsadatok", icon: Wrench },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    api.me().catch(() => router.push("/login")).then((u) => u && setUser(u));
  }, [router]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex min-h-screen w-60 flex-col justify-between bg-[var(--sidebar)] py-4 text-[var(--sidebar-foreground)]">
        <div>
          <div className="mb-6 px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ubrankovics-logo.svg"
              alt="Ubrankovics"
              className="w-full"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname?.startsWith(href);
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
    </div>
  );
}
