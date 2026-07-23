
-- Convert helper functions used in RLS to SECURITY INVOKER (they only read tables the caller already has RLS access to).
CREATE OR REPLACE FUNCTION public.is_admin(_business uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=_business AND user_id=_user AND role IN ('owner','manager'));
$$;

CREATE OR REPLACE FUNCTION public.is_member(_business uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=_business AND user_id=_user);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_business uuid, _user uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=_business AND user_id=_user AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.my_business_id(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT business_id FROM public.business_members WHERE user_id=_user ORDER BY created_at LIMIT 1;
$$;

-- Pin search_path on the updated-at trigger helper.
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- handle_new_user must remain SECURITY DEFINER (runs from an auth trigger writing to public tables).
-- Lock it down so it is not callable from the API surface.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
