"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Building2, FileClock, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  api,
  CRM_CUSTOMER_TYPE_LABELS,
  CrmContract,
  CrmCustomer,
  CrmDashboardStats,
  CrmTask,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<string, string> = {
  person: "bg-accent-400",
  company: "bg-accent-600",
  sole_proprietor: "bg-accent-800",
};
const TYPE_ORDER = ["person", "company", "sole_proprietor"];

/* ─── Stat kártya (kompakt info-box, a sima Dashboard mintájára) ─── */
function StatCard({
  label, value, sub, icon: Icon, iconBg, iconColor, href,
}: {
  label: string; value: string | number | null; sub?: string;
  icon: LucideIcon; iconBg: string; iconColor: string; href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="flex-row items-center gap-3 p-3 shadow-sm transition hover:shadow-md">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <Icon className={cn("size-4.5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          {value === null ? (
            <div className="mt-1 h-5 w-1/2 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-xl font-bold leading-tight text-foreground">{value}</p>
          )}
        </div>
        {sub && <p className="shrink-0 text-[10px] text-muted-foreground">{sub}</p>}
      </Card>
    </Link>
  );
}

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<CrmDashboardStats | null>(null);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [contracts, setContracts] = useState<CrmContract[]>([]);
  const [me, setMe] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    api.crmDashboardStats().then(setStats).catch(console.error);
    api.crmCustomers().then(setCustomers).catch(console.error);
    api.me().then(setMe).catch(console.error);
    // Both already scoped by the backend the same way the standalone list
    // endpoints are (owner-chain for tasks, customer-owner for contracts) —
    // reused as-is, no dashboard-specific endpoint needed.
    api.crmTasks({ status: "open" }).then((t) => setTasks(t.slice(0, 6))).catch(console.error);
    api.crmContracts({ status: "active" }).then((all) => {
      const today = Date.now();
      const horizon = today + 30 * 86400000;
      const expiring = all
        .filter((c) => {
          const end = new Date(c.end_date).getTime();
          return end >= today && end <= horizon;
        })
        .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
      setContracts(expiring.slice(0, 6));
    }).catch(console.error);
  }, []);

  const recentCustomers = useMemo(
    () => [...customers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8),
    [customers],
  );

  const totalByType = stats ? Object.values(stats.customers_by_type).reduce((s, n) => s + n, 0) : 0;

  return (
    <AppLayout>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-foreground">CRM Dashboard</h1>
        {me && (
          <p className="text-xs text-muted-foreground">
            Üdvözlünk, <span className="font-semibold text-foreground">{me.full_name}</span>!
          </p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Ügyfelek összesen" value={stats?.total_customers ?? null} sub="Összesen" icon={Building2} iconBg="bg-accent" iconColor="text-accent-foreground" href="/crm/customers" />
        <StatCard label="Nyitott feladatok" value={stats?.open_tasks ?? null} sub="Saját" icon={ListChecks} iconBg="bg-warning-bg" iconColor="text-warning-foreground" href="/crm/customers" />
        <StatCard label="Lejáró szerződések" value={stats?.expiring_contracts_30d ?? null} sub="30 napon belül" icon={AlarmClock} iconBg="bg-critical-bg" iconColor="text-critical" href="/crm/customers" />
        <StatCard label="Függő ajánlatok" value={stats?.pending_quotes ?? null} sub="Kiküldve / jóváhagyásra vár" icon={FileClock} iconBg="bg-neutral-100" iconColor="text-neutral-700" href="/crm/customers" />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Card className="p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aktív ügyfelek</p>
          <p className="mt-1 text-xl font-bold leading-tight text-foreground">{stats?.active_customers ?? "…"}</p>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Új ügyfelek (30 nap)</p>
          <p className="mt-1 text-xl font-bold leading-tight text-foreground">{stats?.new_customers_30d ?? "…"}</p>
        </Card>
        <Card className="p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aktív szerződések</p>
          <p className="mt-1 text-xl font-bold leading-tight text-foreground">{stats?.active_contracts ?? "…"}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="overflow-hidden py-0 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[13px] font-semibold text-foreground">Ügyféleloszlás</h2>
            <Link href="/crm/customers" className="text-[11px] text-primary hover:underline">Összes</Link>
          </div>
          <div className="p-3">
            {!stats || totalByType === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nincs ügyfél</p>
            ) : (
              <div className="space-y-1.5">
                {TYPE_ORDER.filter((t) => stats.customers_by_type[t] > 0).map((t) => {
                  const count = stats.customers_by_type[t] ?? 0;
                  const pct = totalByType > 0 ? Math.round((count / totalByType) * 100) : 0;
                  return (
                    <div key={t} className="flex items-center gap-2 text-[11px]">
                      <span className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[t])} />
                      <span className="flex-1 text-foreground/80">{CRM_CUSTOMER_TYPE_LABELS[t] ?? t}</span>
                      <span className="font-semibold text-foreground">{count}</span>
                      <span className="w-8 text-right text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden py-0 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[13px] font-semibold text-foreground">Legutóbbi ügyfelek</h2>
            <Link href="/crm/customers" className="flex items-center gap-0.5 text-[11px] text-primary hover:underline">Mind</Link>
          </div>
          <div className="divide-y divide-border">
            {recentCustomers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nincs ügyfél</p>
            ) : (
              recentCustomers.map((c) => (
                <Link key={c.id} href={`/crm/customers/${c.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">{c.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{c.customer_number}</p>
                  </div>
                  <Badge className="shrink-0 px-1.5 py-0 text-[9px] bg-neutral-100 text-neutral-700">
                    {CRM_CUSTOMER_TYPE_LABELS[c.type] ?? c.type}
                  </Badge>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("hu-HU")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden py-0 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[13px] font-semibold text-foreground">Nyitott feladatok</h2>
          </div>
          <div className="divide-y divide-border">
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nincs nyitott feladat</p>
            ) : (
              tasks.slice(0, 6).map((t) => (
                <Link key={t.id} href={`/crm/customers/${t.customer_id}?tab=tasks`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">{t.name}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(t.due_date).toLocaleDateString("hu-HU")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="overflow-hidden py-0 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[13px] font-semibold text-foreground">Lejáró szerződések</h2>
            <span className="text-[10px] text-muted-foreground">30 napon belül</span>
          </div>
          <div className="divide-y divide-border">
            {contracts.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nincs lejáró szerződés</p>
            ) : (
              contracts.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/crm/customers/${c.customer_id}?tab=contracts`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">{c.contract_number}</p>
                  </div>
                  <Badge className="shrink-0 px-1.5 py-0 text-[9px] bg-critical-bg text-critical">
                    {new Date(c.end_date).toLocaleDateString("hu-HU")}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
