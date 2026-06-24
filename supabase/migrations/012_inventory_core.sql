-- Divdev ERP — Inventory V1: locations, balances, ledger, transfer documents
-- Safe to run multiple times (idempotent).

-- ===========================================================================
-- 1. Stock locations
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_locations_name_unique UNIQUE (name)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_code_unique_idx
  ON public.stock_locations (code)
  WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_one_default_idx
  ON public.stock_locations (is_default)
  WHERE is_default = true;

DROP TRIGGER IF EXISTS stock_locations_set_updated_at ON public.stock_locations;
CREATE TRIGGER stock_locations_set_updated_at
  BEFORE UPDATE ON public.stock_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- 2. Stock balances (materialized on-hand qty)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.stock_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES public.stock_locations (id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity_on_hand  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_balances_location_product_unique UNIQUE (location_id, product_id)
);

CREATE INDEX IF NOT EXISTS stock_balances_location_id_idx ON public.stock_balances (location_id);
CREATE INDEX IF NOT EXISTS stock_balances_product_id_idx ON public.stock_balances (product_id);

-- ===========================================================================
-- 3. Document headers
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.stock_in_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES public.stock_locations (id) ON DELETE RESTRICT,
  remarks      TEXT,
  created_by   UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location_id UUID NOT NULL REFERENCES public.stock_locations (id) ON DELETE RESTRICT,
  to_location_id   UUID NOT NULL REFERENCES public.stock_locations (id) ON DELETE RESTRICT,
  remarks          TEXT,
  created_by         UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_transfers_locations_distinct CHECK (from_location_id <> to_location_id)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id  UUID NOT NULL REFERENCES public.stock_transfers (id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  CONSTRAINT stock_transfer_lines_transfer_product_unique UNIQUE (transfer_id, product_id)
);

CREATE INDEX IF NOT EXISTS stock_transfer_lines_transfer_id_idx
  ON public.stock_transfer_lines (transfer_id);

-- ===========================================================================
-- 4. Inventory ledger (append-only)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type   TEXT NOT NULL,
  location_id     UUID NOT NULL REFERENCES public.stock_locations (id) ON DELETE RESTRICT,
  product_id      UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  transfer_id     UUID REFERENCES public.stock_transfers (id) ON DELETE SET NULL,
  stock_in_id     UUID REFERENCES public.stock_in_batches (id) ON DELETE SET NULL,
  invoice_id      UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
  invoice_item_id UUID REFERENCES public.invoice_items (id) ON DELETE SET NULL,
  remarks         TEXT,
  created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_ledger_movement_type_check CHECK (
    movement_type IN (
      'STOCK_IN',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'INVOICE_SALE',
      'INVOICE_CANCEL'
    )
  )
);

CREATE INDEX IF NOT EXISTS inventory_ledger_location_product_idx
  ON public.inventory_ledger (location_id, product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_ledger_created_at_idx
  ON public.inventory_ledger (created_at DESC);

CREATE INDEX IF NOT EXISTS inventory_ledger_invoice_id_idx
  ON public.inventory_ledger (invoice_id);

CREATE INDEX IF NOT EXISTS inventory_ledger_transfer_id_idx
  ON public.inventory_ledger (transfer_id);

-- ===========================================================================
-- 5. Seed locations
-- ===========================================================================
INSERT INTO public.stock_locations (name, code, sort_order, is_default)
VALUES
  ('Rajkot', 'RJT', 1, true),
  ('Ahmedabad', 'AMD', 2, false),
  ('Warehouse', 'WH', 3, false),
  ('Nutrition Club', 'NC', 4, false)
ON CONFLICT (name) DO NOTHING;

-- Ensure exactly one default when seeding on existing DBs
UPDATE public.stock_locations
SET is_default = false
WHERE is_default = true
  AND name <> 'Rajkot'
  AND EXISTS (SELECT 1 FROM public.stock_locations WHERE name = 'Rajkot');

UPDATE public.stock_locations
SET is_default = true
WHERE name = 'Rajkot'
  AND NOT EXISTS (SELECT 1 FROM public.stock_locations WHERE is_default = true);

-- ===========================================================================
-- 6. Row Level Security
-- ===========================================================================
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_in_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;

-- stock_locations
DROP POLICY IF EXISTS "stock_locations_select_admin" ON public.stock_locations;
DROP POLICY IF EXISTS "stock_locations_insert_admin" ON public.stock_locations;
DROP POLICY IF EXISTS "stock_locations_update_admin" ON public.stock_locations;

CREATE POLICY "stock_locations_select_admin"
  ON public.stock_locations FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "stock_locations_insert_admin"
  ON public.stock_locations FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "stock_locations_update_admin"
  ON public.stock_locations FOR UPDATE TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- stock_balances (read-only for clients; mutations via SECURITY DEFINER functions)
DROP POLICY IF EXISTS "stock_balances_select_admin" ON public.stock_balances;

CREATE POLICY "stock_balances_select_admin"
  ON public.stock_balances FOR SELECT TO authenticated
  USING (public.is_erp_admin());

-- inventory_ledger (read-only for clients)
DROP POLICY IF EXISTS "inventory_ledger_select_admin" ON public.inventory_ledger;

CREATE POLICY "inventory_ledger_select_admin"
  ON public.inventory_ledger FOR SELECT TO authenticated
  USING (public.is_erp_admin());

-- stock_in_batches
DROP POLICY IF EXISTS "stock_in_batches_select_admin" ON public.stock_in_batches;
DROP POLICY IF EXISTS "stock_in_batches_insert_admin" ON public.stock_in_batches;

CREATE POLICY "stock_in_batches_select_admin"
  ON public.stock_in_batches FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "stock_in_batches_insert_admin"
  ON public.stock_in_batches FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());

-- stock_transfers
DROP POLICY IF EXISTS "stock_transfers_select_admin" ON public.stock_transfers;
DROP POLICY IF EXISTS "stock_transfers_insert_admin" ON public.stock_transfers;

CREATE POLICY "stock_transfers_select_admin"
  ON public.stock_transfers FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "stock_transfers_insert_admin"
  ON public.stock_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());

-- stock_transfer_lines
DROP POLICY IF EXISTS "stock_transfer_lines_select_admin" ON public.stock_transfer_lines;
DROP POLICY IF EXISTS "stock_transfer_lines_insert_admin" ON public.stock_transfer_lines;

CREATE POLICY "stock_transfer_lines_select_admin"
  ON public.stock_transfer_lines FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "stock_transfer_lines_insert_admin"
  ON public.stock_transfer_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());
