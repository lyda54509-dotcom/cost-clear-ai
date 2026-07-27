-- Ensure businesses insert policy exists and is correct
DROP POLICY IF EXISTS "businesses insert owner" ON public.businesses;
CREATE POLICY "businesses insert owner"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Allow the owner to insert their own initial business_members row
-- (they aren't an admin yet at that instant, so is_admin() check fails)
DROP POLICY IF EXISTS "members insert self as owner" ON public.business_members;
CREATE POLICY "members insert self as owner"
  ON public.business_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'::app_role
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.owner_id = auth.uid()
    )
  );