import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatKES, formatPct, todayISO } from "@/lib/format";
import { generateReport } from "@/lib/reports.functions";
import { reportInputSchema, firstZodMessage } from "@/lib/validation";
import { toast } from "sonner";
import { Sparkles, Send, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports · ProfitTrack" }, { name: "description", content: "Generate AI-powered daily, monthly, or annual profit reports." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: ctx } = useBusiness();
  const qc = useQueryClient();
  const gen = useServerFn(generateReport);
  const [type, setType] = useState<"daily" | "monthly" | "annual">("daily");
  const [ref, setRef] = useState(todayISO());

  const list = useQuery({
    queryKey: ["reports", ctx?.business.id],
    enabled: !!ctx?.business.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("business_id", ctx!.business.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const genMut = useMutation({
    mutationFn: async () => {
      const parsed = reportInputSchema.safeParse({ periodType: type, referenceDate: ref });
      if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
      return gen({ data: { businessId: ctx!.business.id, periodType: type, referenceDate: ref } });
    },
    onSuccess: (r) => {
      const net = r.analysis?.metrics?.net ?? 0;
      const desc = `Net ${formatKES(net)} · ${formatPct(r.analysis?.metrics?.margin ?? 0)} margin`;
      if (r.webhookStatus === "sent") toast.success("Report generated & sent", { description: desc });
      else if (r.webhookStatus === "failed") toast.warning("Report saved, but delivery failed", { description: r.webhookError ?? "The n8n workflow rejected the request." });
      else toast.success("Report generated", { description: desc });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: Error) => toast.error("Could not generate report", { description: e.message }),
  });

  const refError = (() => {
    const p = reportInputSchema.safeParse({ periodType: type, referenceDate: ref });
    return p.success ? null : firstZodMessage(p.error);
  })();

  return (
    <AppShell>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Reports</h1>
      <p className="text-sm text-muted-foreground mb-6">Generate an AI-powered summary and submit it to your team via the configured webhook.</p>

      <Card className="p-6 mb-6">
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Period</Label>
            <Select value={type} onValueChange={(v) => setType(v as "daily" | "monthly" | "annual")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference date</Label>
            <Input type="date" max={todayISO()} value={ref} aria-invalid={!!refError} onChange={(e) => setRef(e.target.value)} />
            {refError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {refError}</p>}
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => genMut.mutate()} disabled={genMut.isPending || !!refError || !ctx?.business.id}>
              <Sparkles className="h-4 w-4 mr-2" /> {genMut.isPending ? "Generating…" : "Generate & submit report"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Aggregates sales, expenses, and M-Pesa uploads for the selected period, then posts to your n8n webhook.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {(list.data ?? []).length === 0 ? (
          <Card className="p-6"><p className="text-sm text-muted-foreground">No reports generated yet.</p></Card>
        ) : (
          (list.data ?? []).map((r) => {
            const rev = Number(r.total_revenue);
            const net = Number(r.net_profit);
            const margin = rev > 0 ? (net / rev) * 100 : 0;
            return (
              <Card key={r.id} className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="capitalize">{r.period_type}</Badge>
                      <span className="text-sm text-muted-foreground">{r.period_start} → {r.period_end}</span>
                      {r.sent_at && <Badge variant="outline" className="text-success border-success"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>}
                    </div>
                    <div className="text-3xl font-bold tabular-nums mt-1">{formatKES(net)}</div>
                    <div className="text-xs text-muted-foreground">Net profit · {formatPct(margin)} margin</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><div className="text-xs text-muted-foreground">Revenue</div><div className="tabular-nums font-medium">{formatKES(rev)}</div></div>
                    <div><div className="text-xs text-muted-foreground">COGS</div><div className="tabular-nums font-medium">{formatKES(r.total_cogs)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Expenses</div><div className="tabular-nums font-medium">{formatKES(r.total_expenses)}</div></div>
                  </div>
                </div>
                {r.ai_summary && (
                  <div className="mt-4 p-4 rounded-lg bg-secondary/50 border-l-4 border-accent">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-accent mb-1"><Sparkles className="h-3 w-3" /> AI insight</div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{r.ai_summary}</p>
                  </div>
                )}
                {!r.sent_at && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                    <Send className="h-3 w-3" /> Webhook not sent — configure it in Settings to auto-deliver reports.
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
