import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BusinessContext = {
  business: {
    id: string;
    name: string;
    owner_id: string;
    webhook_url: string | null;
    recipient_email: string | null;
    recipient_whatsapp: string | null;
  };
  role: "owner" | "manager" | "staff";
};

export function useBusiness() {
  return useQuery<BusinessContext | null>({
    queryKey: ["business-context"],
    retry: 1,
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data: member, error } = await supabase
        .from("business_members")
        .select("role, business_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!member) return null;

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id,name,owner_id,webhook_url,recipient_email,recipient_whatsapp")
        .eq("id", member.business_id)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!business) return null;

      return { business: business as BusinessContext["business"], role: member.role as BusinessContext["role"] };
    },
  });
}
