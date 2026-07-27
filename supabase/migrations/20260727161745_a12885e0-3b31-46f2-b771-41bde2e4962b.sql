DROP POLICY IF EXISTS "members admin manage" ON public.business_members;
DROP POLICY IF EXISTS "members select in own business" ON public.business_members;
DROP POLICY IF EXISTS "businesses select member" ON public.businesses;

CREATE POLICY "members select own membership"
ON public.business_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "businesses select owner or member"
ON public.businesses
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.business_members bm
    WHERE bm.business_id = businesses.id
      AND bm.user_id = auth.uid()
  )
);