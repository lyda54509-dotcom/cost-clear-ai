import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BusinessContext = {
  business: { id: string; name: string; owner_id: string; webhook_url: string | null };
  role: "owner" | "manager" | "staff";
};

export function useBusiness() {
  return useQuery<BusinessContext | null>({
    queryKey: ["business-context"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data: member, error } = await supabase
        .from("business_members")
        .select("role, business_id, businesses:business_id(id,name,owner_id,webhook_url)")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!member || !member.businesses) return null;
      // businesses may come back as array in some typings — normalize
      const biz = Array.isArray(member.businesses) ? member.businesses[0] : member.businesses;
      return { business: biz as BusinessContext["business"], role: member.role as BusinessContext["role"] };
    },
  });
}
