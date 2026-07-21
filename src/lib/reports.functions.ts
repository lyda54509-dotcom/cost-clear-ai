import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { analyzePeriod } from "./ai.functions";

function periodRange(type: "daily" | "monthly" | "annual", ref: string): { start: string; end: string } {
  const d = new Date(ref + "T00:00:00Z");
  if (type === "daily") return { start: ref, end: ref };
  if (type === "monthly") {
    const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
  }
  return { start: `${d.getUTCFullYear()}-01-01`, end: `${d.getUTCFullYear()}-12-31` };
}

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      businessId: z.string().uuid(),
      periodType: z.enum(["daily", "monthly", "annual"]),
      referenceDate: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { start, end } = periodRange(data.periodType, data.referenceDate);
    const analysis = await analyzePeriod({ data: { businessId: data.businessId, periodStart: start, periodEnd: end, periodType: data.periodType } });

    const { data: inserted, error } = await context.supabase
      .from("reports")
      .insert({
        business_id: data.businessId,
        period_type: data.periodType,
        period_start: start,
        period_end: end,
        total_revenue: analysis.metrics.revenue,
        total_cogs: analysis.metrics.cogs,
        total_expenses: analysis.metrics.totalExpenses,
        gross_profit: analysis.metrics.gross,
        net_profit: analysis.metrics.net,
        ai_summary: analysis.summary,
        top_items: analysis.topItems as never,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw error;

    // Fire webhook if configured — non-blocking
    const { data: biz } = await context.supabase.from("businesses").select("webhook_url, name").eq("id", data.businessId).maybeSingle();
    let webhookStatus: "sent" | "skipped" | "failed" = "skipped";
    if (biz?.webhook_url) {
      try {
        const r = await fetch(biz.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business: biz.name,
            report_id: inserted.id,
            period_type: data.periodType,
            period_start: start,
            period_end: end,
            metrics: analysis.metrics,
            top_items: analysis.topItems,
            ai_summary: analysis.summary,
          }),
        });
        webhookStatus = r.ok ? "sent" : "failed";
        if (r.ok) {
          await context.supabase.from("reports").update({ sent_at: new Date().toISOString() }).eq("id", inserted.id);
        }
      } catch { webhookStatus = "failed"; }
    }

    return { report: inserted, analysis, webhookStatus };
  });
