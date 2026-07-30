import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { formatKES, formatPct, itemKey, itemLabel } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · ProfitTrack" }, { name: "description", content: "Today's profit, month-to-date, and year-to-date at a glance." }] }),
  component: DashboardPage,
});

type Sale = { entry_date: string; quantity: number; buying_price: number; selling_price: number; item_name: string };
type Expense = { expense_date: string; amount: number };
type Upload = { upload_date: string; extracted_data: { total_amount?: number } | null };

function DashboardPage() {
  const { data: ctx } = useBusiness();
  const businessId = ctx?.business.id;

  const salesQ = useQuery({
    queryKey: ["sales", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_entries").select("entry_date, quantity, buying_price, selling_price, item_name").eq("business_id", businessId!).order("entry_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as Sale[];
    },
  });
  const expensesQ = useQuery({
    queryKey: ["expenses", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("expense_date, amount").eq("business_id", businessId!).limit(1000);
      if (error) throw error;
      return data as Expense[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);

  const sales = salesQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const bucket = (period: (d: string) => boolean) => {
    const s = sales.filter((x) => period(x.entry_date));
    const revenue = s.reduce((a, x) => a + Number(x.quantity) * Number(x.selling_price), 0);
    const cogs = s.reduce((a, x) => a + Number(x.quantity) * Number(x.buying_price), 0);
    const exp = expenses.filter((x) => period(x.expense_date)).reduce((a, x) => a + Number(x.amount), 0);
    const gross = revenue - cogs;
    const net = gross - exp;
    const margin = revenue > 0 ? (net / revenue) * 100 : null;
    return { revenue, cogs, exp, gross, net, margin };
  };

  const day = bucket((d) => d === today);
  const mtd = bucket((d) => d.startsWith(month));
  const ytd = bucket((d) => d.startsWith(year));

  // Trend: last 14 days
  const days: { date: string; net: number; gross: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const b = bucket((x) => x === iso);
    days.push({ date: iso.slice(5), net: Math.round(b.net), gross: Math.round(b.gross) });
  }

  // Item breakdown — grouped case-insensitively so "chips" and "Chips" are one item
  const items = new Map<string, { label: string; qty: number; revenue: number; cogs: number }>();
  for (const s of sales) {
    const key = itemKey(s.item_name);
    const cur = items.get(key) ?? { label: itemLabel(s.item_name), qty: 0, revenue: 0, cogs: 0 };
    cur.qty += Number(s.quantity);
    cur.revenue += Number(s.quantity) * Number(s.selling_price);
    cur.cogs += Number(s.quantity) * Number(s.buying_price);
    items.set(key, cur);
  }
  const itemRows = [...items.values()].map((v) => ({ name: v.label, qty: v.qty, revenue: v.revenue, cogs: v.cogs, margin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // Receipts / M-Pesa reconciliation
  const uploads = uploadsQ.data ?? [];
  const uploadTotal = (period: (d: string) => boolean) =>
    uploads.filter((u) => period(u.upload_date)).reduce((a, u) => a + (Number(u.extracted_data?.total_amount) || 0), 0);
  const captureToday = uploadTotal((d) => d === today);
  const captureMonth = uploadTotal((d) => d.startsWith(month));
  const diffMonth = captureMonth - mtd.revenue;
  const mismatch = captureMonth > 0 && Math.abs(diffMonth) > Math.max(1, captureMonth * 0.1);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{ctx?.business.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Today" gross={day.gross} net={day.net} margin={day.margin} revenue={day.revenue} />
        <StatCard label="This month" gross={mtd.gross} net={mtd.net} margin={mtd.margin} revenue={mtd.revenue} />
        <StatCard label="This year" gross={ytd.gross} net={ytd.net} margin={ytd.margin} revenue={ytd.revenue} />
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-semibold">Receipts &amp; M-Pesa reconciliation</h2>
            <p className="text-xs text-muted-foreground">Uploaded totals vs sales you logged</p>
          </div>
          <Link to="/uploads" className="text-xs text-accent inline-flex items-center gap-1">Uploads <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground">Uploaded today</div><div className="tabular-nums font-medium">{formatKES(captureToday)}</div></div>
          <div><div className="text-xs text-muted-foreground">Sales logged today</div><div className="tabular-nums font-medium">{formatKES(day.revenue)}</div></div>
          <div><div className="text-xs text-muted-foreground">Uploaded this month</div><div className="tabular-nums font-medium">{formatKES(captureMonth)}</div></div>
          <div>
            <div className="text-xs text-muted-foreground">Month difference</div>
            <div className={`tabular-nums font-medium ${mismatch ? "text-warning" : "text-success"}`}>{formatKES(diffMonth)}</div>
          </div>
        </div>
        {mismatch && (
          <p className="text-xs text-warning mt-3">
            {diffMonth > 0
              ? "Your uploaded receipts total more than the sales entered — some sales are probably missing from Sales."
              : "You've logged more sales than your uploaded receipts show — check for duplicate or over-stated entries."}
          </p>
        )}
        {uploads.length === 0 && <p className="text-xs text-muted-foreground mt-3">No receipts uploaded yet, so nothing to reconcile.</p>}
      </Card>


      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Profit trend</h2>
            <p className="text-xs text-muted-foreground">Last 14 days · net vs gross</p>
          </div>
          <Link to="/reports" className="text-xs text-accent inline-flex items-center gap-1">Reports <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatKES(v)} />
              <Line type="monotone" dataKey="gross" stroke="var(--color-chart-5)" strokeWidth={2} dot={false} name="Gross" />
              <Line type="monotone" dataKey="net" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} name="Net" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Item performance</h2>
        {itemRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales logged yet. <Link to="/sales" className="text-accent underline">Add your first entry</Link>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">COGS</th>
                  <th className="text-right py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((r) => (
                  <tr key={r.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="text-right py-2 tabular-nums">{r.qty}</td>
                    <td className="text-right py-2 tabular-nums">{formatKES(r.revenue)}</td>
                    <td className="text-right py-2 tabular-nums text-muted-foreground">{formatKES(r.cogs)}</td>
                    <td className={`text-right py-2 tabular-nums font-medium ${r.margin >= 20 ? "text-success" : r.margin >= 0 ? "text-warning" : "text-destructive"}`}>{formatPct(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}

function StatCard({ label, gross, net, margin, revenue }: { label: string; gross: number; net: number; margin: number | null; revenue: number }) {
  const positive = net >= 0;
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className={`text-3xl font-bold tabular-nums ${positive ? "text-foreground" : "text-destructive"}`}>{formatKES(net)}</div>
        {positive ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
      </div>
      <div className="text-xs text-muted-foreground mt-1">Net profit</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div><div className="text-muted-foreground">Revenue</div><div className="tabular-nums font-medium">{formatKES(revenue)}</div></div>
        <div><div className="text-muted-foreground">Gross</div><div className="tabular-nums font-medium">{formatKES(gross)}</div></div>
        <div><div className="text-muted-foreground">Margin</div><div className="tabular-nums font-medium">{formatPct(margin)}</div></div>
      </div>
    </Card>
  );
}
