-- Divdev ERP — Rollback for 020_quotations.sql
-- Drops quotation tables, functions, triggers and business_settings columns.
-- Safe to run multiple times (idempotent).
--
-- NOT a Supabase CLI migration — run manually in the SQL editor when needed.
-- WARNING: This permanently removes all quotation data.

-- ===========================================================================
-- 1. Drop triggers
-- ===========================================================================
DROP TRIGGER IF EXISTS quotation_items_validate ON public.quotation_items;
DROP TRIGGER IF EXISTS quotation_items_sync_quotation ON public.quotation_items;
DROP TRIGGER IF EXISTS quotations_sync_tax ON public.quotations;
DROP TRIGGER IF EXISTS quotations_validate_status ON public.quotations;
DROP TRIGGER IF EXISTS quotations_set_quotation_number ON public.quotations;
DROP TRIGGER IF EXISTS quotations_set_updated_at ON public.quotations;

-- ===========================================================================
-- 2. Drop functions
-- ===========================================================================
DROP FUNCTION IF EXISTS public.validate_quotation_item();
DROP FUNCTION IF EXISTS public.handle_quotation_item_change();
DROP FUNCTION IF EXISTS public.handle_quotation_tax_change();
DROP FUNCTION IF EXISTS public.validate_quotation_status_transition();
DROP FUNCTION IF EXISTS public.recompute_quotation(UUID);
DROP FUNCTION IF EXISTS public.set_quotation_number();
DROP FUNCTION IF EXISTS public.generate_next_quotation_number();
DROP FUNCTION IF EXISTS public.convert_quotation_to_invoice(UUID);

-- ===========================================================================
-- 3. Drop tables (cascades to quotation_items via FK)
-- ===========================================================================
DROP TABLE IF EXISTS public.quotation_items;
DROP TABLE IF EXISTS public.quotations;

-- ===========================================================================
-- 4. Drop business_settings columns
-- ===========================================================================
ALTER TABLE public.business_settings
  DROP COLUMN IF EXISTS next_quotation_number;
ALTER TABLE public.business_settings
  DROP COLUMN IF EXISTS quotation_prefix;
