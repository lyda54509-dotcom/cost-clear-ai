import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · ProfitTrack" }, { name: "description", content: "Business name, team members, and n8n webhook configuration." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: ctx } = useBusiness();
  const isAdmin = ctx && (ctx.role === "owner" || ctx.role === "manager");
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [webhook, setWebhook] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientWhatsapp, setRecipientWhatsapp] = useState("");

  useEffect(() => {
    if (ctx?.business) {
      setName(ctx.business.name);
      setWebhook(ctx.business.webhook_url ?? "");
      const b = ctx.business as unknown as { recipient_email?: string | null; recipient_whatsapp?: string | null };
      setRecipientEmail(b.recipient_email ?? "");
      setRecipientWhatsapp(b.recipient_whatsapp ?? "");
    }
  }, [ctx?.business]);

  const members = useQuery({
    queryKey: ["members", ctx?.business.id],
    enabled: !!ctx?.business.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_members")
        .select("id, role, user_id, profiles:user_id(email, full_name)")
        .eq("business_id", ctx!.business.id);
      if (error) throw error;
      return data;
    },
  });

  const saveBiz = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("businesses").update({
        name,
        webhook_url: webhook || null,
        recipient_email: recipientEmail || null,
        recipient_whatsapp: recipientWhatsapp || null,
      } as never).eq("id", ctx!.business.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["business-context"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Settings</h1>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-1">Business</h2>
        <p className="text-xs text-muted-foreground mb-4">Reports are POSTed to the ProfitTrack n8n workflow on every generation. Add recipient details so the workflow can route delivery.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Business name</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} /></div>
          <div>
            <Label>Custom webhook URL <span className="text-muted-foreground font-normal">(optional, legacy)</span></Label>
            <Input placeholder="https://…" value={webhook} onChange={(e) => setWebhook(e.target.value)} disabled={!isAdmin} />
            <p className="text-xs text-muted-foreground mt-1">If set, reports are also POSTed here in addition to the n8n workflow.</p>
          </div>
          <div>
            <Label>Recipient email</Label>
            <Input type="email" placeholder="owner@business.co.ke" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <Label>Recipient WhatsApp</Label>
            <Input placeholder="+2547XXXXXXXX" value={recipientWhatsapp} onChange={(e) => setRecipientWhatsapp(e.target.value)} disabled={!isAdmin} />
          </div>
        </div>
        {isAdmin && <Button className="mt-4" onClick={() => saveBiz.mutate()} disabled={saveBiz.isPending}>Save</Button>}
      </Card>


      <Card className="p-6">
        <h2 className="font-semibold mb-1">Team</h2>
        <p className="text-xs text-muted-foreground mb-4">Staff members can log sales and upload receipts. Owners & managers can also manage expenses and settings.</p>
        <div className="space-y-2">
          {(members.data ?? []).map((m) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <div key={m.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div>
                  <div className="font-medium text-sm">{profile?.full_name || profile?.email || m.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{profile?.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.role === "owner" ? "default" : "secondary"} className="capitalize">{m.role}</Badge>
                </div>
              </div>
            );
          })}
        </div>
        {isAdmin && (
          <p className="text-xs text-muted-foreground mt-4">To add staff: have them sign up, then contact support to add them to this business. (Direct member management coming soon.)</p>
        )}
        {/* placeholder for future icon usage */}
        <Trash2 className="hidden" />
      </Card>
    </AppShell>
  );
}
