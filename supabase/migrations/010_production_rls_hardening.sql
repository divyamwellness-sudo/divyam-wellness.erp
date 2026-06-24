-- Divyam Wellness ERP — Production RLS hardening
-- Single-admin allowlist; replaces broad authenticated CRUD policies.
-- Safe to run multiple times (idempotent).
--
-- Prerequisites:
--   * Disable public signup in Supabase Auth before production use.
--   * After first apply, verify erp_admin contains the intended user:
--       SELECT ea.user_id, u.email
--       FROM public.erp_admin ea
--       JOIN auth.users u ON u.id = ea.user_id;
--   * To pin a specific admin instead of auto-seed, insert manually then re-run:
--       INSERT INTO public.erp_admin (user_id) VALUES ('<uuid>') ON CONFLICT DO NOTHING;

-- ===========================================================================
-- 1. Admin allowlist
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.erp_admin (
  user_id     UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.erp_admin IS
  'Allowlist of ERP admin user IDs. Client mutations blocked via RLS; manage via SQL/service_role.';

ALTER TABLE public.erp_admin ENABLE ROW LEVEL SECURITY;

-- Seed the earliest auth user only when the allowlist is empty (single-admin MVP).
INSERT INTO public.erp_admin (user_id)
SELECT u.id
FROM auth.users AS u
WHERE NOT EXISTS (SELECT 1 FROM public.erp_admin)
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

-- ===========================================================================
-- 2. Admin helper
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.is_erp_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.erp_admin
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_erp_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_erp_admin() TO authenticated;

COMMENT ON FUNCTION public.is_erp_admin() IS
  'Returns true when the current JWT user is in public.erp_admin.';

-- ===========================================================================
-- 3. Drop broad authenticated policies (and prior admin policies on re-run)
-- ===========================================================================

-- customers
DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_update_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_select_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_update_admin" ON public.customers;

-- weight_logs
DROP POLICY IF EXISTS "weight_logs_select_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_insert_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_update_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_delete_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_select_admin" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_insert_admin" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_update_admin" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_delete_admin" ON public.weight_logs;

-- products
DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_update_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_delete_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_select_admin" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;

-- invoices
DROP POLICY IF EXISTS "invoices_select_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_orphan_admin" ON public.invoices;

-- invoice_items
DROP POLICY IF EXISTS "invoice_items_select_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_select_admin" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_admin" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_admin" ON public.invoice_items;

-- payments
DROP POLICY IF EXISTS "payments_select_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_update_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;

-- business_settings
DROP POLICY IF EXISTS "business_settings_select_authenticated" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_update_authenticated" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_select_admin" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_update_admin" ON public.business_settings;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin_own" ON public.profiles;

-- ===========================================================================
-- 4. Admin-only policies
-- ===========================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- customers (no client DELETE — app deactivates via UPDATE)
CREATE POLICY "customers_select_admin"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "customers_insert_admin"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "customers_update_admin"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- weight_logs
CREATE POLICY "weight_logs_select_admin"
  ON public.weight_logs
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "weight_logs_insert_admin"
  ON public.weight_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "weight_logs_update_admin"
  ON public.weight_logs
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "weight_logs_delete_admin"
  ON public.weight_logs
  FOR DELETE
  TO authenticated
  USING (public.is_erp_admin());

-- products (no client DELETE — app toggles is_active via UPDATE)
CREATE POLICY "products_select_admin"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "products_insert_admin"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "products_update_admin"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- invoices (orphan DELETE preserves createInvoice rollback)
CREATE POLICY "invoices_select_admin"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "invoices_insert_admin"
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "invoices_update_admin"
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "invoices_delete_orphan_admin"
  ON public.invoices
  FOR DELETE
  TO authenticated
  USING (
    public.is_erp_admin()
    AND status = 'created'
    AND NOT EXISTS (
      SELECT 1
      FROM public.invoice_items AS ii
      WHERE ii.invoice_id = invoices.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments AS p
      WHERE p.invoice_id = invoices.id
    )
  );

-- invoice_items (no client DELETE)
CREATE POLICY "invoice_items_select_admin"
  ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "invoice_items_insert_admin"
  ON public.invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "invoice_items_update_admin"
  ON public.invoice_items
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- payments (no client DELETE)
CREATE POLICY "payments_select_admin"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "payments_insert_admin"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "payments_update_admin"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- business_settings
CREATE POLICY "business_settings_select_admin"
  ON public.business_settings
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "business_settings_update_admin"
  ON public.business_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- profiles (admin + own row; no client INSERT — handle_new_user trigger)
CREATE POLICY "profiles_select_admin_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin() AND auth.uid() = id);

CREATE POLICY "profiles_update_admin_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_erp_admin() AND auth.uid() = id)
  WITH CHECK (public.is_erp_admin() AND auth.uid() = id);
