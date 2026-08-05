"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileSignature } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppLayout from "@/components/AppLayout";
import {
  api,
  CRM_CUSTOMER_STATUS_LABELS,
  CRM_CUSTOMER_STATUS_ORDER,
  CRM_SOURCE_LABELS,
  CRM_SOURCE_UNKNOWN_LABEL,
  SalesDashboardMonthly,
  SalesDashboardWeekly,
  ValidQuotesSummary,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTH_NAMES = [
  "Január", "Február", "Március", "Április", "Május", "Június",
  "Július", "Augusztus", "Szeptember", "Október", "November", "December",
];

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const PIPELINE_COLORS: Record<string, string> = {
  new: "var(--chart-2)",
  inquiring: "var(--chart-1)",
  quote_sent: "var(--color-warning)",
  ordered: "var(--chart-3)",
  archived: "var(--chart-4)",
};

function hufFormat(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return String(value);
  return `${num.toLocaleString("hu-HU")} Ft`;
}

function hufCompact(value: string | number): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return String(value);
  if (num >= 1_000_000) return `${(num / 1_000_000).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M Ft`;
  return hufFormat(num);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold leading-tight text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function ValidQuotesCard() {
  const [data, setData] = useState<ValidQuotesSummary | null>(null);

  useEffect(() => {
    api.salesDashboardValidQuotes().then(setData).catch(() => setData(null));
  }, []);

  return (
    <Card className="mb-3 flex flex-row items-center gap-3 p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <FileSignature className="size-5" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Érvényes ajánlatok</p>
        <p className="text-xl font-bold leading-tight text-foreground">
          {data ? `${data.count} db` : "…"}
          <span className="ml-2 text-sm font-medium text-muted-foreground">
            {data ? hufCompact(data.total_value) : ""}
          </span>
        </p>
      </div>
    </Card>
  );
}

function WeeklyView() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [data, setData] = useState<SalesDashboardWeekly | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.salesDashboardWeekly(weekStart ?? undefined)
      .then((d) => { setData(d); setWeekStart(d.week_start); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const activityData = data
    ? [
        { name: "Ajánlat kiküldve", value: data.quotes_sent, fill: "var(--chart-1)" },
        { name: "Telekszemle / tárgyalás", value: data.site_visits, fill: "var(--chart-3)" },
      ]
    : [];

  const pipelineData = data
    ? CRM_CUSTOMER_STATUS_ORDER.map((status) => ({
        name: CRM_CUSTOMER_STATUS_LABELS[status] ?? status,
        value: data.pipeline.find((b) => b.status === status)?.count ?? 0,
        fill: PIPELINE_COLORS[status] ?? "var(--chart-4)",
      }))
    : [];

  return (
    <div className={loading ? "opacity-60" : ""}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.week_start} – ${data.week_end}` : "…"}
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" disabled={!weekStart} onClick={() => setWeekStart(addDays(weekStart!, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={!weekStart} onClick={() => setWeekStart(addDays(weekStart!, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricTile label="Szerződések (db)" value={String(data?.contracts_signed_count ?? "…")} sub="Múlt heti záráskor" />
        <MetricTile label="Szerződések értéke" value={data ? hufCompact(data.contracts_signed_value) : "…"} />
        <MetricTile label="Aktív ügyfelek" value={String(data?.active_customers ?? "…")} sub="Nem archivált" />
        <MetricTile label="Új érdeklődők" value={String(data?.new_inquiries ?? "…")} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Heti aktivitás</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {activityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline eloszlás</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {pipelineData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MonthlyView() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<SalesDashboardMonthly | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.salesDashboardMonthly(month ?? undefined)
      .then((d) => { setData(d); setMonth(d.month); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  const monthDate = data ? new Date(data.month + "T00:00:00") : null;

  const trendData = data
    ? data.trend.map((t) => ({
        name: `${MONTH_NAMES[t.month - 1].slice(0, 3)}`,
        value: Number(t.contracted_value),
      }))
    : [];

  const sourceData = data
    ? data.source_breakdown.map((b) => ({
        name: b.source ? CRM_SOURCE_LABELS[b.source] ?? b.source : CRM_SOURCE_UNKNOWN_LABEL,
        value: b.count,
      }))
    : [];

  const funnelData = data
    ? [
        { name: "Érdeklődők", value: data.funnel.leads, fill: "var(--chart-1)" },
        { name: "Tárgyalás alatt", value: data.funnel.negotiations, fill: "var(--chart-3)" },
        { name: "Szerződés", value: data.funnel.contracts, fill: "var(--chart-5)" },
      ]
    : [];

  return (
    <div className={loading ? "opacity-60" : ""}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {monthDate ? `${monthDate.getFullYear()}. ${MONTH_NAMES[monthDate.getMonth()]}` : "…"}
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" disabled={!month} onClick={() => setMonth(addMonths(month!, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={!month} onClick={() => setMonth(addMonths(month!, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <MetricTile label="Havi szerződéses érték" value={data ? hufCompact(data.total_contracted_value) : "…"} />
        <MetricTile
          label="Átlagos szerződésérték"
          value={data?.average_contract_value ? hufCompact(data.average_contract_value) : "Nincs adat"}
        />
        <MetricTile
          label="Átlagos ciklusidő"
          value={data?.average_sales_cycle_days != null ? `${Math.round(data.average_sales_cycle_days)} nap` : "Nincs adat"}
          sub="Első kapcsolattól aláírásig"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Havi szerződéses trend (6 hónap)</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => hufCompact(v)} width={80} />
                <Tooltip formatter={(v) => hufFormat(v as number)} />
                <Line type="monotone" dataKey="value" name="Szerződéses érték" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ügyfélszerzési források</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 220 }}>
            {sourceData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Nincs adat</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Konverziós tölcsér</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {data && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Érdeklődő → tárgyalás: {Math.round(data.funnel.lead_to_negotiation_pct)}% · Tárgyalás → szerződés:{" "}
                {Math.round(data.funnel.negotiation_to_contract_pct)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SalesDashboardPage() {
  return (
    <AppLayout>
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CRM</p>
        <h1 className="text-2xl font-heading font-semibold text-foreground">Értékesítési dashboard</h1>
      </div>

      <ValidQuotesCard />

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">Heti</TabsTrigger>
          <TabsTrigger value="monthly">Havi</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="mt-4">
          <WeeklyView />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <MonthlyView />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
