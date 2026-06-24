-- Divdev ERP — Inventory: guarded stock location deletion
-- Safe to run multiple times (idempotent).

CREATE OR REPLACE FUNCTION public.delete_stock_location(p_location_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location public.stock_locations%ROWTYPE;
BEGIN
  SELECT *
    INTO v_location
    FROM public.stock_locations
    WHERE id = p_location_id;

  IF v_location.id IS NULL THEN
    RAISE EXCEPTION 'Location not found';
  END IF;

  IF v_location.is_default = true THEN
    RAISE EXCEPTION 'Cannot delete the default location.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_balances
    WHERE location_id = p_location_id
  ) THEN
    RAISE EXCEPTION
      'LOCATION_HAS_HISTORY: This location contains inventory history. Deactivate it instead.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_ledger
    WHERE location_id = p_location_id
  ) THEN
    RAISE EXCEPTION
      'LOCATION_HAS_HISTORY: This location contains inventory history. Deactivate it instead.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invoices
    WHERE stock_location_id = p_location_id
  ) THEN
    RAISE EXCEPTION
      'LOCATION_HAS_HISTORY: This location contains inventory history. Deactivate it instead.';
  END IF;

  DELETE FROM public.stock_locations
    WHERE id = p_location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_stock_location(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_stock_location(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_stock_location IS
  'Deletes a stock location when it has no balances, ledger entries, or invoices.';
