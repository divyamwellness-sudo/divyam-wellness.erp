-- Divyam Wellness ERP — Rollback for 010_production_rls_hardening.sql
-- Restores broad authenticated CRUD policies from migrations 001–007.
-- Safe to run multiple times (idempotent).
--
-- NOT a Supabase CLI migration — run manually in the SQL editor when needed.
-- WARNING: Re-opens full CRUD to any authenticated user.

-- ===========================================================================
-- 1. Drop admin-only policies
-- ===========================================================================

-- customers
DROP POLICY IF EXISTS "customers_select_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_admin" ON public.customers;
DROP POLICY IF EXISTS "customers_update_admin" ON public.customers;

-- weight_logs
DROP POLICY IF EXISTS "weight_logs_select_admin" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_insert_admin" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_update_admin" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_delete_admin" ON public.weight_logs;

-- products
DROP POLICY IF EXISTS "products_select_admin" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;

-- invoices
DROP POLICY IF EXISTS "invoices_select_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_orphan_admin" ON public.invoices;

-- invoice_items
DROP POLICY IF EXISTS "invoice_items_select_admin" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_admin" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_admin" ON public.invoice_items;

-- payments
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;

-- business_settings
DROP POLICY IF EXISTS "business_settings_select_admin" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_update_admin" ON public.business_settings;

-- profiles
DROP POLICY IF EXISTS "profiles_select_admin_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin_own" ON public.profiles;

-- ===========================================================================
-- 2. Restore broad authenticated policies
-- ===========================================================================

-- customers
DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_update_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_authenticated" ON public.customers;

CREATE POLICY "customers_select_authenticated"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "customers_insert_authenticated"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customers_update_authenticated"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customers_delete_authenticated"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- weight_logs
DROP POLICY IF EXISTS "weight_logs_select_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_insert_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_update_authenticated" ON public.weight_logs;
DROP POLICY IF EXISTS "weight_logs_delete_authenticated" ON public.weight_logs;

CREATE POLICY "weight_logs_select_authenticated"
  ON public.weight_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_insert_authenticated"
  ON public.weight_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_update_authenticated"
  ON public.weight_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_delete_authenticated"
  ON public.weight_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- products
DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_update_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_delete_authenticated" ON public.products;

CREATE POLICY "products_select_authenticated"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "products_insert_authenticated"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "products_update_authenticated"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "products_delete_authenticated"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- invoices
DROP POLICY IF EXISTS "invoices_select_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_authenticated" ON public.invoices;

CREATE POLICY "invoices_select_authenticated"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_insert_authenticated"
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_update_authenticated"
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_delete_authenticated"
  ON public.invoices
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- invoice_items
DROP POLICY IF EXISTS "invoice_items_select_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_authenticated" ON public.invoice_items;

CREATE POLICY "invoice_items_select_authenticated"
  ON public.invoice_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_items_insert_authenticated"
  ON public.invoice_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_items_update_authenticated"
  ON public.invoice_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_items_delete_authenticated"
  ON public.invoice_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- payments
DROP POLICY IF EXISTS "payments_select_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_update_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_authenticated" ON public.payments;

CREATE POLICY "payments_select_authenticated"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "payments_insert_authenticated"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payments_update_authenticated"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payments_delete_authenticated"
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- business_settings
DROP POLICY IF EXISTS "business_settings_select_authenticated" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_update_authenticated" ON public.business_settings;

CREATE POLICY "business_settings_select_authenticated"
  ON public.business_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "business_settings_update_authenticated"
  ON public.business_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ===========================================================================
-- 3. Remove admin infrastructure
-- ===========================================================================
DROP FUNCTION IF EXISTS public.is_erp_admin();

DROP TABLE IF EXISTS public.erp_admin;
