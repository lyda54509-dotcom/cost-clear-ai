import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { analyzePeriod } from "./ai.functions";

const N8N_WEBHOOK_URL = "https://profittrack-ops.app.n8n.cloud/webhook/profittrack-report";

/**
 * Validate a user-supplied webhook URL to prevent SSRF:
 * - must be https
 * - host must be a public DNS name (not an IP literal, not localhost/*.local)
 * - resolved addresses must not be private/loopback/link-local/unique-local
 */
async function isSafePublicHttpsUrl(raw: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Reject IP literals outright — only allow named hosts we can DNS-check.
  const isIPv4Literal = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isIPv6Literal = host.includes(":") || (host.startsWith("[") && host.endsWith("]"));
  if (isIPv4Literal || isIPv6Literal) return false;
  // DNS resolution check via a public resolver (dns.google over https).
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`, { method: "GET" });
    if (!res.ok) return false;
    const j = (await res.json()) as { Answer?: { type: number; data: string }[] };
    const ips = (j.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data);
    if (ips.length === 0) return false;
    for (const ip of ips) {
      if (isPrivateIPv4(ip)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;                      // 10.0.0.0/8
  if (a === 127) return true;                     // loopback
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 169 && b === 254) return true;        // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;        // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;                      // multicast + reserved
  return false;
}


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

type MpesaTx = { ref?: string | null; amount?: number | null; date?: string | null; counterparty?: string | null; description?: string | null; time?: string | null };

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

    // Load payload data in parallel
    const [bizR, salesR, expR, upR] = await Promise.all([
      context.supabase.from("businesses").select("name, recipient_email, recipient_whatsapp, webhook_url").eq("id", data.businessId).maybeSingle(),
      context.supabase.from("sales_entries").select("item_name, quantity, buying_price, selling_price, entry_date").eq("business_id", data.businessId).gte("entry_date", start).lte("entry_date", end),
      context.supabase.from("expenses").select("category, amount, expense_date").eq("business_id", data.businessId).gte("expense_date", start).lte("expense_date", end),
      context.supabase.from("uploads").select("extracted_data, upload_date, upload_type").eq("business_id", data.businessId).gte("upload_date", start).lte("upload_date", end),
    ]);

    const biz = bizR.data;
    const sales = (salesR.data ?? []).map((s) => ({
      item: s.item_name,
      quantity: Number(s.quantity),
      unit_price: Number(s.selling_price),
      cost_price: Number(s.buying_price),
      date: s.entry_date,
    }));
    const expenses = (expR.data ?? []).map((e) => ({
      category: e.category,
      amount: Number(e.amount),
      date: e.expense_date,
    }));
    const mpesa_statement: Array<{ ref: string | null; amount: number; date: string; counterparty: string | null; source: string }> = [];
    for (const u of upR.data ?? []) {
      const ed = u.extracted_data as { transactions?: MpesaTx[] } | null;
      const txs = ed?.transactions ?? [];
      for (const t of txs) {
        const desc = t.description ?? null;
        const refMatch = desc?.match(/\(([A-Z0-9]{6,})\)/) ?? desc?.match(/\b([A-Z]{3}[A-Z0-9]{5,})\b/);
        const counterparty = t.counterparty ?? (desc ? desc.replace(/\s*\([^)]*\)\s*$/, "").trim() : null);
        mpesa_statement.push({
          ref: t.ref ?? refMatch?.[1] ?? null,
          amount: Number(t.amount) || 0,
          date: t.date ?? u.upload_date,
          counterparty: counterparty || null,
          source: (u.upload_type as string) ?? "receipt",
        });
      }
    }

    const payload = {
      business_id: data.businessId,
      business_name: biz?.name ?? null,
      report_type: data.periodType,
      period_start: start,
      period_end: end,
      sales,
      expenses,
      mpesa_statement,
      recipient: {
        email: biz?.recipient_email ?? null,
        whatsapp: biz?.recipient_whatsapp ?? null,
      },
      metrics: analysis.metrics,
      top_items: analysis.topItems,
      ai_summary: analysis.summary,
      report_id: inserted.id,
    };

    // POST to n8n webhook (plus any user-configured webhook_url as legacy fallback).
    // The user-configured URL is validated to prevent SSRF into internal networks.
    const safeCustom = biz?.webhook_url && (await isSafePublicHttpsUrl(biz.webhook_url)) ? biz.webhook_url : null;
    const targets = [N8N_WEBHOOK_URL, ...(safeCustom ? [safeCustom] : [])];
    let webhookStatus: "sent" | "skipped" | "failed" = "skipped";
    let webhookError: string | null = null;
    for (const url of targets) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          redirect: "error",
        });
        webhookStatus = r.ok ? "sent" : "failed";
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          webhookError = `${url} responded ${r.status}: ${body.slice(0, 200)}`;
          console.error("[generateReport] webhook failed", webhookError);
        }
        if (r.ok && url === N8N_WEBHOOK_URL) {
          await context.supabase.from("reports").update({ sent_at: new Date().toISOString() }).eq("id", inserted.id);
        }
      } catch (e) {
        webhookStatus = "failed";
        webhookError = `${url}: ${e instanceof Error ? e.message : "request failed"}`;
        console.error("[generateReport] webhook error", webhookError);
      }
    }


    return { report: inserted, analysis, webhookStatus, webhookError };
  });
