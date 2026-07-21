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
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses · ProfitTrack" }, { name: "description", content: "Manage rent, wages, utilities and other operating expenses." }] }),
  component: ExpensesPage,
});

const CATEGORIES = ["Rent", "Wages", "Utilities", "Transport", "Supplies", "Marketing", "Other"];

function ExpensesPage() {
  const { data: ctx } = useBusiness();
  const isAdmin = ctx && (ctx.role === "owner" || ctx.role === "manager");
  const qc = useQueryClient();
  const [category, setCategory] = useState("Rent");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [recurring, setRecurring] = useState(false);
  const [notes, setNotes] = useState("");

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
      const { data: userData } = await supabase.auth.getUser();
      if (!amount || Number(amount) <= 0) throw new Error("Enter an amount");
      const { error } = await supabase.from("expenses").insert({
        business_id: ctx!.business.id,
        category, amount: Number(amount), expense_date: date, is_recurring: recurring, notes: notes || null,
        created_by: userData.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setAmount(""); setNotes("");
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
        <div className="grid md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount (KES)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={recurring} onCheckedChange={setRecurring} id="rec" />
            <Label htmlFor="rec" className="cursor-pointer">Recurring</Label>
          </div>
        </div>
        <div className="mt-4"><Button onClick={() => add.mutate()} disabled={add.isPending}>Add expense</Button></div>
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
