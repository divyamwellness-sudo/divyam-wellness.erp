-- Divdev ERP — Inventory: explicit default location management
-- Safe to run multiple times (idempotent).

-- ===========================================================================
-- 1. Atomic set-default RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.set_default_stock_location(p_location_id UUID)
RETURNS UUID
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

  IF v_location.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cannot set an inactive location as default';
  END IF;

  UPDATE public.stock_locations
    SET is_default = false,
        updated_at = NOW()
    WHERE is_default = true
      AND id <> p_location_id;

  UPDATE public.stock_locations
    SET is_default = true,
        updated_at = NOW()
    WHERE id = p_location_id;

  RETURN p_location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_stock_location(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_stock_location(UUID) TO authenticated;

COMMENT ON FUNCTION public.set_default_stock_location IS
  'Clears the current default and sets the given active location as default atomically.';

-- ===========================================================================
-- 2. Deactivate guards: stock on hand + default location
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.prevent_deactivate_location_with_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    IF OLD.is_default = true THEN
      RAISE EXCEPTION
        'Cannot deactivate the default location. Set another location as default first.';
    END IF;

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
  END IF;

  RETURN NEW;
END;
$$;
