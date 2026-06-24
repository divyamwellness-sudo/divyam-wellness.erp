-- Divdev ERP — Inventory V1 refinements: multi-line stock in, location deactivate guard
-- Safe to run multiple times (idempotent).

-- ===========================================================================
-- 1. Stock in line items (multi-product documents)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.stock_in_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES public.stock_in_batches (id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  CONSTRAINT stock_in_lines_batch_product_unique UNIQUE (batch_id, product_id)
);

CREATE INDEX IF NOT EXISTS stock_in_lines_batch_id_idx
  ON public.stock_in_lines (batch_id);

ALTER TABLE public.stock_in_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_in_lines_select_admin" ON public.stock_in_lines;
DROP POLICY IF EXISTS "stock_in_lines_insert_admin" ON public.stock_in_lines;

CREATE POLICY "stock_in_lines_select_admin"
  ON public.stock_in_lines FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "stock_in_lines_insert_admin"
  ON public.stock_in_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());

-- ===========================================================================
-- 2. Multi-line stock in RPC (replaces single-product signature)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.stock_in(UUID, UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.stock_in(
  p_location_id UUID,
  p_lines       JSONB,
  p_remarks     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id   UUID;
  v_line       JSONB;
  v_product_id UUID;
  v_quantity   INTEGER;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one stock in line is required';
  END IF;

  INSERT INTO public.stock_in_batches (location_id, remarks)
  VALUES (p_location_id, p_remarks)
  RETURNING id INTO v_batch_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line ->> 'product_id')::UUID;
    v_quantity := (v_line ->> 'quantity')::INTEGER;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Each stock in line requires product_id and quantity > 0';
    END IF;

    INSERT INTO public.stock_in_lines (batch_id, product_id, quantity)
    VALUES (v_batch_id, v_product_id, v_quantity);

    PERFORM public.apply_inventory_movement(
      'STOCK_IN',
      p_location_id,
      v_product_id,
      v_quantity,
      p_remarks,
      NULL,
      v_batch_id,
      NULL,
      NULL
    );
  END LOOP;

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stock_in(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_in(UUID, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.stock_in IS
  'Creates a multi-line stock in document and increases location stock.';

-- ===========================================================================
-- 3. Prevent deactivating locations that still hold stock
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.prevent_deactivate_location_with_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    IF EXISTS (
      SELECT 1
      FROM public.stock_balances
      WHERE location_id = NEW.id
        AND quantity_on_hand > 0
    ) THEN
      RAISE EXCEPTION
        'Cannot deactivate location "%" while stock remains on hand',
        NEW.name;
    END IF;

    IF NEW.is_default = true THEN
      NEW.is_default := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_locations_prevent_deactivate_with_stock ON public.stock_locations;
CREATE TRIGGER stock_locations_prevent_deactivate_with_stock
  BEFORE UPDATE OF is_active ON public.stock_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_deactivate_location_with_stock();
