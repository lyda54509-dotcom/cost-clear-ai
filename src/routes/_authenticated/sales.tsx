import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKES, todayISO, formatPct } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales entry · ProfitTrack" }, { name: "description", content: "Log items sold with quantity, cost, and selling price." }] }),
  component: SalesPage,
});

type Row = { item_name: string; quantity: string; buying_price: string; selling_price: string };
const emptyRow = (): Row => ({ item_name: "", quantity: "1", buying_price: "", selling_price: "" });

function SalesPage() {
  const { data: ctx } = useBusiness();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const list = useQuery({
    queryKey: ["sales-today", ctx?.business.id, date],
    enabled: !!ctx?.business.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_entries")
        .select("id, item_name, quantity, buying_price, selling_price, entry_date, created_at")
        .eq("business_id", ctx!.business.id)
        .eq("entry_date", date)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const insertMut = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const valid = rows
        .map((r) => ({
          business_id: ctx!.business.id,
          item_name: r.item_name.trim(),
          quantity: Number(r.quantity),
          buying_price: Number(r.buying_price),
          selling_price: Number(r.selling_price),
          entry_date: date,
          entered_by: uid,
        }))
        .filter((r) => r.item_name && r.quantity > 0 && r.selling_price >= 0);
      if (!valid.length) throw new Error("Add at least one valid item");
      const { error } = await supabase.from("sales_entries").insert(valid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sales logged");
      setRows([emptyRow()]);
      qc.invalidateQueries({ queryKey: ["sales-today"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("sales_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sales-today"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
  };

  return (
    <AppShell>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Sales entry</h1>

      <Card className="p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => {
            const profit = (Number(r.selling_price) - Number(r.buying_price)) * Number(r.quantity || 0);
            return (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-2 items-end">
                <div>
                  {i === 0 && <Label>Item</Label>}
                  <Input placeholder="Chapati" value={r.item_name} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, item_name: e.target.value } : x))} />
                </div>
                <div>
                  {i === 0 && <Label>Qty</Label>}
                  <Input type="number" min="0" step="1" value={r.quantity} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                </div>
                <div>
                  {i === 0 && <Label>Cost (KES)</Label>}
                  <Input type="number" min="0" step="0.01" value={r.buying_price} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, buying_price: e.target.value } : x))} />
                </div>
                <div>
                  {i === 0 && <Label>Sell (KES)</Label>}
                  <Input type="number" min="0" step="0.01" value={r.selling_price} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, selling_price: e.target.value } : x))} />
                </div>
                <div className="text-sm tabular-nums text-muted-foreground px-2 pb-2 whitespace-nowrap">
                  {isFinite(profit) ? formatKES(profit) : ""}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="h-4 w-4 mr-1" /> Add row</Button>
          <Button onClick={() => insertMut.mutate()} disabled={insertMut.isPending}>{insertMut.isPending ? "Saving…" : "Save entries"}</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Entries for {date}</h2>
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet for this date.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Cost</th>
                  <th className="text-right py-2">Sell</th>
                  <th className="text-right py-2">Profit</th>
                  <th className="text-right py-2">Margin</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((r) => {
                  const rev = r.quantity * r.selling_price;
                  const profit = (r.selling_price - r.buying_price) * r.quantity;
                  const margin = rev > 0 ? (profit / rev) * 100 : 0;
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{r.item_name}</td>
                      <td className="text-right tabular-nums">{r.quantity}</td>
                      <td className="text-right tabular-nums">{formatKES(r.buying_price)}</td>
                      <td className="text-right tabular-nums">{formatKES(r.selling_price)}</td>
                      <td className={`text-right tabular-nums font-medium ${profit >= 0 ? "text-success" : "text-destructive"}`}>{formatKES(profit)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{formatPct(margin)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
