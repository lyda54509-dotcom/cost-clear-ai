import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Receipt, Wallet, Upload, FileBarChart2, Settings, LogOut, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Onboarding } from "@/components/Onboarding";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", label: "Sales entry", icon: Receipt },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/uploads", label: "Receipts", icon: Upload },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: ctx } = useBusiness();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-6 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ProfitTrack</div>
            <div className="text-xs text-sidebar-foreground/60">AI Profit Analyzer</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-2 text-xs text-sidebar-foreground/60">
            <div className="font-medium text-sidebar-foreground truncate">{ctx?.business.name ?? "—"}</div>
            <div className="capitalize">{ctx?.role ?? ""}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sidebar-primary" />
            <span className="font-semibold">ProfitTrack</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <nav className="md:hidden flex overflow-x-auto gap-1 px-2 py-2 border-b bg-card">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-md ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
