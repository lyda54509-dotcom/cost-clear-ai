
-- Enums
CREATE TYPE public.app_role AS ENUM ('owner','manager','staff');
CREATE TYPE public.upload_type AS ENUM ('receipt','mpesa_statement');
CREATE TYPE public.report_period AS ENUM ('daily','monthly','annual');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read own or same business" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Businesses
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Members
CREATE TABLE public.business_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_member(_business UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=_business AND user_id=_user);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_business UUID, _user UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=_business AND user_id=_user AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_business UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=_business AND user_id=_user AND role IN ('owner','manager'));
$$;

CREATE OR REPLACE FUNCTION public.my_business_id(_user UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.business_members WHERE user_id=_user ORDER BY created_at LIMIT 1;
$$;

-- Now member policies
CREATE POLICY "members select in own business" ON public.business_members FOR SELECT TO authenticated
  USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "members admin manage" ON public.business_members FOR ALL TO authenticated
  USING (public.is_admin(business_id, auth.uid()))
  WITH CHECK (public.is_admin(business_id, auth.uid()));

-- Business policies
CREATE POLICY "businesses select member" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_member(id, auth.uid()));
CREATE POLICY "businesses insert owner" ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "businesses update admin" ON public.businesses FOR UPDATE TO authenticated
  USING (public.is_admin(id, auth.uid())) WITH CHECK (public.is_admin(id, auth.uid()));

-- Profiles: allow reading profiles of members in same business
CREATE POLICY "profiles read same business" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS(
    SELECT 1 FROM public.business_members m1
    JOIN public.business_members m2 ON m1.business_id = m2.business_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  ));

-- Sales entries
CREATE TABLE public.sales_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  buying_price NUMERIC(12,2) NOT NULL CHECK (buying_price >= 0),
  selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
  entry_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.sales_entries(business_id, entry_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_entries TO authenticated;
GRANT ALL ON public.sales_entries TO service_role;
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales select member" ON public.sales_entries FOR SELECT TO authenticated
  USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "sales insert member" ON public.sales_entries FOR INSERT TO authenticated
  WITH CHECK (public.is_member(business_id, auth.uid()) AND entered_by = auth.uid());
CREATE POLICY "sales update admin or own" ON public.sales_entries FOR UPDATE TO authenticated
  USING (public.is_admin(business_id, auth.uid()) OR entered_by = auth.uid())
  WITH CHECK (public.is_member(business_id, auth.uid()));
CREATE POLICY "sales delete admin" ON public.sales_entries FOR DELETE TO authenticated
  USING (public.is_admin(business_id, auth.uid()));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.expenses(business_id, expense_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses select member" ON public.expenses FOR SELECT TO authenticated
  USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "expenses manage admin" ON public.expenses FOR ALL TO authenticated
  USING (public.is_admin(business_id, auth.uid()))
  WITH CHECK (public.is_admin(business_id, auth.uid()));

-- Uploads
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  upload_type upload_type NOT NULL DEFAULT 'receipt',
  upload_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  extracted_data JSONB,
  reconciliation_status TEXT DEFAULT 'pending',
  reconciliation_note TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.uploads(business_id, upload_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploads select member" ON public.uploads FOR SELECT TO authenticated
  USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "uploads insert member" ON public.uploads FOR INSERT TO authenticated
  WITH CHECK (public.is_member(business_id, auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "uploads update admin" ON public.uploads FOR UPDATE TO authenticated
  USING (public.is_admin(business_id, auth.uid()))
  WITH CHECK (public.is_admin(business_id, auth.uid()));
CREATE POLICY "uploads delete admin" ON public.uploads FOR DELETE TO authenticated
  USING (public.is_admin(business_id, auth.uid()));

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_type report_period NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_cogs NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(14,2) NOT NULL DEFAULT 0,
  ai_summary TEXT,
  top_items JSONB,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.reports(business_id, period_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports select member" ON public.reports FOR SELECT TO authenticated
  USING (public.is_member(business_id, auth.uid()));
CREATE POLICY "reports insert member" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (public.is_member(business_id, auth.uid()));
CREATE POLICY "reports manage admin" ON public.reports FOR UPDATE TO authenticated
  USING (public.is_admin(business_id, auth.uid()))
  WITH CHECK (public.is_admin(business_id, auth.uid()));

-- Handle new user: create profile + business + owner membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_biz UUID;
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.businesses(name, owner_id)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'business_name','My Business'), NEW.id)
    RETURNING id INTO new_biz;

  INSERT INTO public.business_members(business_id, user_id, role)
    VALUES (new_biz, NEW.id, 'owner');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
