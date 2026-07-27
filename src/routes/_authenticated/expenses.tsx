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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatKES, todayISO } from "@/lib/format";
import { expenseSchema, firstZodMessage } from "@/lib/validation";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses · ProfitTrack" }, { name: "description", content: "Manage rent, wages, utilities and other operating expenses." }] }),
  component: ExpensesPage,
});

const CATEGORIES = ["Rent", "Wages", "Utilities", "Transport", "Supplies", "Marketing", "Other"];

type Row = {
  category: string;
  amount: string;
  expense_date: string;
  recurring: boolean;
  notes: string;
};
const emptyRow = (): Row => ({ category: "Rent", amount: "", expense_date: todayISO(), recurring: false, notes: "" });

function ExpensesPage() {
  const { data: ctx } = useBusiness();
  const isAdmin = ctx && (ctx.role === "owner" || ctx.role === "manager");
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const list = useQuery({
    queryKey: ["expenses-list", ctx?.business.id],
    enabled: !!ctx?.business.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("business_id", ctx!.business.id).order("expense_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const nonEmpty = rows
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => r.amount.trim() !== "" || r.notes.trim() !== "");
      if (!nonEmpty.length) throw new Error("Add at least one expense before saving");

      const errors: Record<number, string> = {};
      const valid: Array<{
        business_id: string; category: string; amount: number; expense_date: string;
        is_recurring: boolean; notes: string | null; created_by: string;
      }> = [];

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      for (const { r, idx } of nonEmpty) {
        const parsed = expenseSchema.safeParse({
          category: r.category,
          amount: Number(r.amount),
          expense_date: r.expense_date,
          notes: r.notes || undefined,
        });
        if (!parsed.success) {
          errors[idx] = firstZodMessage(parsed.error);
          continue;
        }
        const d = new Date(parsed.data.expense_date + "T00:00:00Z").getTime();
        if (d > Date.now() + 24 * 3600 * 1000) {
          errors[idx] = "Date cannot be in the future";
          continue;
        }
        valid.push({
          business_id: ctx!.business.id,
          category: parsed.data.category,
          amount: parsed.data.amount,
          expense_date: parsed.data.expense_date,
          is_recurring: r.recurring,
          notes: parsed.data.notes ?? null,
          created_by: uid,
        });
      }
      setRowErrors(errors);
      if (Object.keys(errors).length) {
        throw new Error(`Fix ${Object.keys(errors).length} row${Object.keys(errors).length > 1 ? "s" : ""} before saving`);
      }

      const total = valid.reduce((s, v) => s + v.amount, 0);
      const { error } = await supabase.from("expenses").insert(valid);
      if (error) throw error;
      return { count: valid.length, total };
    },
    onSuccess: (r) => {
      setRowErrors({});
      toast.success(`${r.count} expense${r.count > 1 ? "s" : ""} recorded`, { description: `${formatKES(r.total)} added.` });
      setRows([emptyRow()]);
      qc.invalidateQueries({ queryKey: ["expenses-list"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["expenses-list"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  if (!isAdmin) {
    return <AppShell><Card className="p-6"><p className="text-sm text-muted-foreground">Only owners and managers can manage expenses.</p></Card></AppShell>;
  }

  return (
    <AppShell>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Expenses</h1>

      <Card className="p-6 mb-6">
        <div className="space-y-3">
          {rows.map((r, i) => {
            const rowErr = rowErrors[i];
            const update = (patch: Partial<Row>) => {
              setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              if (rowErr) setRowErrors((prev) => { const n = { ...prev }; delete n[i]; return n; });
            };
            return (
              <div key={i} className="space-y-1">
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto_auto] gap-2 items-end">
                  <div>
                    {i === 0 && <Label>Category</Label>}
                    <Select value={r.category} onValueChange={(v) => update({ category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    {i === 0 && <Label>Amount (KES)</Label>}
                    <Input type="number" min="0" step="0.01" aria-invalid={!!rowErr} value={r.amount} onChange={(e) => update({ amount: e.target.value })} />
                  </div>
                  <div>
                    {i === 0 && <Label>Date</Label>}
                    <Input type="date" max={todayISO()} value={r.expense_date} onChange={(e) => update({ expense_date: e.target.value })} />
                  </div>
                  <div>
                    {i === 0 && <Label>Notes</Label>}
                    <Input value={r.notes} maxLength={500} onChange={(e) => update({ notes: e.target.value })} placeholder="Optional" />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch checked={r.recurring} onCheckedChange={(v) => update({ recurring: v })} id={`rec-${i}`} />
                    <Label htmlFor={`rec-${i}`} className="cursor-pointer text-xs">Recurring</Label>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {rowErr && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {rowErr}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}><Plus className="h-4 w-4 mr-1" /> Add row</Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>{add.isPending ? "Saving…" : "Save expenses"}</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Recent expenses</h2>
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-2">Date</th><th className="text-left py-2">Category</th><th className="text-left py-2">Notes</th><th className="text-right py-2">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 tabular-nums">{e.expense_date}</td>
                  <td className="py-2">{e.category} {e.is_recurring && <span className="ml-1 text-xs text-muted-foreground">(recurring)</span>}</td>
                  <td className="py-2 text-muted-foreground">{e.notes}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{formatKES(e.amount)}</td>
                  <td className="text-right"><Button variant="ghost" size="icon" onClick={() => del(e.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
