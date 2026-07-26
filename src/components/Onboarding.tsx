import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

export function Onboarding() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Please enter a business name");

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData.user?.id;
      if (!uid) throw new Error("You must be signed in");

      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .insert({ name: trimmed, owner_id: uid })
        .select("id")
        .single();
      if (bizErr) throw bizErr;

      const { error: memErr } = await supabase
        .from("business_members")
        .insert({ business_id: biz.id, user_id: uid, role: "owner" });
      if (memErr) throw memErr;

      return biz.id;
    },
    onSuccess: () => {
      toast.success("Business created");
      qc.invalidateQueries({ queryKey: ["business-context"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/40 to-background p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Welcome to ProfitTrack</div>
            <div className="text-xs text-muted-foreground">Let's set up your business</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Business name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mama Njeri Kitchen"
              onKeyDown={(e) => { if (e.key === "Enter") create.mutate(); }}
            />
          </div>
          <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create business"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
