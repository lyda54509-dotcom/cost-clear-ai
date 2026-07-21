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
import { toast } from "sonner";
import { todayISO, formatKES } from "@/lib/format";
import { extractUpload } from "@/lib/ai.functions";
import { FileText, Sparkles, Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads")({
  head: () => ({ meta: [{ title: "Receipts & M-Pesa · ProfitTrack" }, { name: "description", content: "Upload receipts or M-Pesa statements — AI extracts the transactions." }] }),
  component: UploadsPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Read failed"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });
}

function UploadsPage() {
  const { data: ctx } = useBusiness();
  const qc = useQueryClient();
  const extract = useServerFn(extractUpload);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"receipt" | "mpesa_statement">("mpesa_statement");
  const [date, setDate] = useState(todayISO());

  const list = useQuery({
    queryKey: ["uploads-list", ctx?.business.id],
    enabled: !!ctx?.business.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("uploads").select("*").eq("business_id", ctx!.business.id).order("upload_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file");
      if (file.size > 15 * 1024 * 1024) throw new Error("File too large (max 15MB)");
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const path = `${ctx!.business.id}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;

      const { data: row, error } = await supabase.from("uploads").insert({
        business_id: ctx!.business.id,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        upload_type: kind,
        upload_date: date,
        uploaded_by: uid,
      }).select().single();
      if (error) throw error;

      // Run AI extraction
      const dataUrl = await fileToDataUrl(file);
      try {
        await extract({ data: { uploadId: row.id, dataUrl, mimeType: file.type, kind } });
      } catch (e) {
        toast.warning(`Uploaded, but AI extraction failed: ${(e as Error).message}`);
      }
      return row;
    },
    onSuccess: () => {
      toast.success("Upload processed");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["uploads-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Receipts & M-Pesa</h1>
      <p className="text-sm text-muted-foreground mb-6">Upload today's receipt or M-Pesa statement. AI extracts transactions and reconciles against your sales.</p>

      <Card className="p-6 mb-6">
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "receipt" | "mpesa_statement")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa_statement">M-Pesa statement</SelectItem>
                <SelectItem value="receipt">Sales receipt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>File (image or PDF)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending || !file}>
            <UploadIcon className="h-4 w-4 mr-2" /> {uploadMut.isPending ? "Uploading & extracting…" : "Upload & analyze"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Recent uploads</h2>
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No uploads yet.</p>
        ) : (
          <div className="space-y-3">
            {(list.data ?? []).map((u) => {
              const ed = (u.extracted_data as { total_amount?: number; transactions?: unknown[]; notes?: string } | null);
              return (
                <div key={u.id} className="border rounded-lg p-4 flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{u.file_name}</span>
                      <Badge variant="secondary">{u.upload_type === "mpesa_statement" ? "M-Pesa" : "Receipt"}</Badge>
                      <Badge variant="outline">{u.upload_date}</Badge>
                      {u.reconciliation_status === "extracted" && <Badge className="bg-success text-success-foreground"><Sparkles className="h-3 w-3 mr-1" />Extracted</Badge>}
                    </div>
                    {ed && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground tabular-nums">{formatKES(ed.total_amount ?? 0)}</span>
                        {" · "}{ed.transactions?.length ?? 0} transactions
                        {ed.notes && <div className="mt-1 text-xs">{ed.notes}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
