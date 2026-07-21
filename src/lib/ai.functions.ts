import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(body: unknown): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — please top up in workspace settings.");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Extract transactions from an uploaded receipt or M-Pesa statement (image/pdf as data URL). */
export const extractUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ uploadId: z.string().uuid(), dataUrl: z.string(), mimeType: z.string(), kind: z.enum(["receipt", "mpesa_statement"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const isPdf = data.mimeType === "application/pdf";
    const userBlocks: Array<Record<string, unknown>> = [
      { type: "text", text: `You are analyzing a ${data.kind === "mpesa_statement" ? "Kenyan M-Pesa statement" : "sales receipt"} from a small food business. Extract the transactions and return STRICT JSON only, matching this shape:

{
  "transactions": [ { "description": string, "amount": number, "time": string | null } ],
  "total_amount": number,
  "detected_currency": "KES" | "USD" | string,
  "notes": string
}

Amounts are in KES if unclear. Only include money-in / sales transactions (ignore fees, withdrawals, airtime purchases). Return raw JSON with no markdown fences.` },
    ];
    if (isPdf) {
      userBlocks.push({ type: "file", file: { filename: "upload.pdf", file_data: data.dataUrl } });
    } else {
      userBlocks.push({ type: "image_url", image_url: { url: data.dataUrl } });
    }

    const content = await callAI({
      model: MODEL,
      messages: [{ role: "user", content: userBlocks }],
      response_format: { type: "json_object" },
    });

    let parsed: unknown = null;
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    const extracted = parsed && typeof parsed === "object" ? parsed : { transactions: [], total_amount: 0, notes: "Could not parse AI response", raw: content };

    const { error } = await context.supabase
      .from("uploads")
      .update({ extracted_data: extracted as never, reconciliation_status: "extracted" })
      .eq("id", data.uploadId);
    if (error) throw error;

    return extracted;
  });

/** Analyze a period's sales/expenses/upload — produce a plain-language summary. */
export const analyzePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      businessId: z.string().uuid(),
      periodStart: z.string(),
      periodEnd: z.string(),
      periodType: z.enum(["daily", "monthly", "annual"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [salesR, expR, upR] = await Promise.all([
      supabase.from("sales_entries").select("item_name, quantity, buying_price, selling_price, entry_date").eq("business_id", data.businessId).gte("entry_date", data.periodStart).lte("entry_date", data.periodEnd),
      supabase.from("expenses").select("category, amount, expense_date").eq("business_id", data.businessId).gte("expense_date", data.periodStart).lte("expense_date", data.periodEnd),
      supabase.from("uploads").select("extracted_data, upload_date, upload_type").eq("business_id", data.businessId).gte("upload_date", data.periodStart).lte("upload_date", data.periodEnd),
    ]);
    if (salesR.error) throw salesR.error;
    if (expR.error) throw expR.error;
    if (upR.error) throw upR.error;

    const sales = salesR.data ?? [];
    const expenses = expR.data ?? [];
    const uploads = upR.data ?? [];

    const revenue = sales.reduce((a, s) => a + Number(s.quantity) * Number(s.selling_price), 0);
    const cogs = sales.reduce((a, s) => a + Number(s.quantity) * Number(s.buying_price), 0);
    const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const gross = revenue - cogs;
    const net = gross - totalExpenses;
    const margin = revenue > 0 ? (net / revenue) * 100 : 0;

    // Item aggregation
    const items = new Map<string, { qty: number; revenue: number; cogs: number }>();
    for (const s of sales) {
      const cur = items.get(s.item_name) ?? { qty: 0, revenue: 0, cogs: 0 };
      cur.qty += Number(s.quantity);
      cur.revenue += Number(s.quantity) * Number(s.selling_price);
      cur.cogs += Number(s.quantity) * Number(s.buying_price);
      items.set(s.item_name, cur);
    }
    const itemStats = [...items.entries()].map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue, profit: v.revenue - v.cogs, margin: v.revenue > 0 ? ((v.revenue - v.cogs) / v.revenue) * 100 : 0 }));
    const top = [...itemStats].sort((a, b) => b.profit - a.profit).slice(0, 3);
    const worst = [...itemStats].sort((a, b) => a.margin - b.margin).slice(0, 3);

    // Upload reconciliation total
    const uploadTotal = uploads.reduce((a, u) => {
      const ed = u.extracted_data as { total_amount?: number } | null;
      return a + (Number(ed?.total_amount) || 0);
    }, 0);

    const prompt = `You are a friendly financial analyst for a Kenyan food business. Write a short plain-English summary (3-5 sentences, no markdown) of this ${data.periodType} performance. Use KES for money. Include:
- Overall verdict (great/ok/concerning) with net profit and margin
- Best-selling / most profitable items
- One flag: worst margin item OR reconciliation mismatch if the uploaded receipts total (KES ${uploadTotal.toFixed(0)}) differs from recorded revenue (KES ${revenue.toFixed(0)}) by more than 10%
- One practical, encouraging suggestion

Numbers:
Revenue: KES ${revenue.toFixed(0)}
COGS: KES ${cogs.toFixed(0)}
Gross profit: KES ${gross.toFixed(0)}
Expenses: KES ${totalExpenses.toFixed(0)}
Net profit: KES ${net.toFixed(0)}
Margin: ${margin.toFixed(1)}%
Top items: ${top.map((t) => `${t.name} (KES ${t.profit.toFixed(0)} profit)`).join(", ") || "none"}
Worst margins: ${worst.map((t) => `${t.name} (${t.margin.toFixed(0)}%)`).join(", ") || "none"}
Uploads captured: ${uploads.length} (total KES ${uploadTotal.toFixed(0)})`;

    const summary = await callAI({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    });

    return {
      metrics: { revenue, cogs, gross, totalExpenses, net, margin, uploadTotal },
      topItems: top,
      worstItems: worst,
      summary: summary.trim(),
    };
  });
