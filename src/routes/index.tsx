import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, LineChart, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProfitTrack — AI Profit Analyzer for Food Businesses" },
      { name: "description", content: "Track daily sales vs cost, reconcile M-Pesa receipts, and get AI-powered profit insights for your restaurant, kiosk or food stall." },
      { property: "og:title", content: "ProfitTrack — AI Profit Analyzer for Food Businesses" },
      { property: "og:description", content: "Track daily sales vs cost, reconcile M-Pesa receipts, and get AI-powered profit insights for your restaurant, kiosk or food stall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">ProfitTrack</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary mb-6">
          <Sparkles className="h-3.5 w-3.5" /> AI-powered daily profit reports
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground max-w-3xl mx-auto leading-[1.05]">
          Know your <span className="text-accent">real profit</span>, every single day.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Log sales, upload your M-Pesa statement, and let AI reconcile the numbers, flag anomalies, and send a clean profit report to the owner — automatically.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Start free</Link></Button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-20 text-left">
          {[
            { icon: LineChart, title: "Daily gross & net profit", body: "Automatic COGS and expense deduction. Margin % you can trust." },
            { icon: ShieldCheck, title: "M-Pesa reconciliation", body: "Upload the statement — AI cross-checks it against logged sales." },
            { icon: Sparkles, title: "Plain-English insights", body: "Best sellers, worst margins, and trend commentary in seconds." },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-xl bg-card border">
              <f.icon className="h-6 w-6 text-accent mb-3" />
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{f.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
