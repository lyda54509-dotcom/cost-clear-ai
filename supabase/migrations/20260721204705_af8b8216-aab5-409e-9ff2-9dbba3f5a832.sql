
-- Path convention: {business_id}/{filename}
CREATE POLICY "receipts read member" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "receipts insert member" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid()));

CREATE POLICY "receipts delete admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND public.is_admin((storage.foldername(name))[1]::uuid, auth.uid()));
