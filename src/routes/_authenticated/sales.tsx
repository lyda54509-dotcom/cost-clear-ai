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
import { saleRowSchema, firstZodMessage } from "@/lib/validation";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";

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
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

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

  const validateDate = (d: string): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Pick a valid date";
    const t = new Date(d + "T00:00:00Z").getTime();
    if (Number.isNaN(t)) return "Pick a valid date";
    if (t > Date.now() + 24 * 3600 * 1000) return "Date cannot be in the future";
    return null;
  };

  const insertMut = useMutation({
    mutationFn: async () => {
      const dateErr = validateDate(date);
      if (dateErr) throw new Error(dateErr);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      // Ignore fully empty rows (item name blank AND no prices) so users can leave a trailing row.
      const nonEmpty = rows
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => r.item_name.trim() || r.buying_price || r.selling_price);
      if (!nonEmpty.length) throw new Error("Add at least one item before saving");

      const errors: Record<number, string> = {};
      const valid: Array<{
        business_id: string; item_name: string; quantity: number;
        buying_price: number; selling_price: number; entry_date: string; entered_by: string;
      }> = [];
      for (const { r, idx } of nonEmpty) {
        const parsed = saleRowSchema.safeParse({
          item_name: r.item_name,
          quantity: Number(r.quantity),
          buying_price: Number(r.buying_price),
          selling_price: Number(r.selling_price),
        });
        if (!parsed.success) {
          errors[idx] = firstZodMessage(parsed.error);
          continue;
        }
        valid.push({
          business_id: ctx!.business.id,
          item_name: parsed.data.item_name,
          quantity: parsed.data.quantity,
          buying_price: parsed.data.buying_price,
          selling_price: parsed.data.selling_price,
          entry_date: date,
          entered_by: uid,
        });
      }
      setRowErrors(errors);
      if (Object.keys(errors).length) {
        throw new Error(`Fix ${Object.keys(errors).length} row${Object.keys(errors).length > 1 ? "s" : ""} before saving`);
      }

      const lossRows = valid.filter((v) => v.selling_price < v.buying_price);
      const { error } = await supabase.from("sales_entries").insert(valid);
      if (error) throw error;
      return { count: valid.length, losses: lossRows.length };
    },
    onSuccess: (r) => {
      setRowErrors({});
      toast.success(`${r.count} sale${r.count > 1 ? "s" : ""} logged`, {
        description: r.losses > 0 ? `${r.losses} item${r.losses > 1 ? "s" : ""} sold below cost — double-check pricing.` : "Profit updated on your dashboard.",
      });
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
            const qty = Number(r.quantity || 0);
            const cost = Number(r.buying_price || 0);
            const sell = Number(r.selling_price || 0);
            const profit = (sell - cost) * qty;
            const belowCost = r.selling_price !== "" && r.buying_price !== "" && sell < cost;
            const rowErr = rowErrors[i];
            const update = (patch: Partial<Row>) => {
              setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              if (rowErr) setRowErrors((prev) => { const n = { ...prev }; delete n[i]; return n; });
            };
            return (
              <div key={i} className="space-y-1">
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-2 items-end">
                  <div>
                    {i === 0 && <Label>Item</Label>}
                    <Input placeholder="Chapati" maxLength={60} aria-invalid={!!rowErr} value={r.item_name} onChange={(e) => update({ item_name: e.target.value })} />
                  </div>
                  <div>
                    {i === 0 && <Label>Qty</Label>}
                    <Input type="number" min="0" step="1" aria-invalid={!!rowErr} value={r.quantity} onChange={(e) => update({ quantity: e.target.value })} />
                  </div>
                  <div>
                    {i === 0 && <Label>Cost (KES)</Label>}
                    <Input type="number" min="0" step="0.01" aria-invalid={!!rowErr} value={r.buying_price} onChange={(e) => update({ buying_price: e.target.value })} />
                  </div>
                  <div>
                    {i === 0 && <Label>Sell (KES)</Label>}
                    <Input type="number" min="0" step="0.01" aria-invalid={!!rowErr} value={r.selling_price} onChange={(e) => update({ selling_price: e.target.value })} />
                  </div>
                  <div className={`text-sm tabular-nums px-2 pb-2 whitespace-nowrap ${belowCost ? "text-destructive" : profit > 0 ? "text-success" : "text-muted-foreground"}`}>
                    {isFinite(profit) && qty > 0 ? formatKES(profit) : ""}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {rowErr && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {rowErr}</p>
                )}
                {!rowErr && belowCost && (
                  <p className="text-xs text-warning flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Selling below cost — you'll book a loss on this item.</p>
                )}
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
