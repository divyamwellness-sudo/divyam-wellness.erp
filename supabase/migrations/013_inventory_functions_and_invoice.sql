-- Divdev ERP — Inventory V1: movement engine, RPCs, invoice integration
-- Safe to run multiple times (idempotent).

-- ===========================================================================
-- 1. Core movement function
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
  p_movement_type   TEXT,
  p_location_id     UUID,
  p_product_id      UUID,
  p_quantity        INTEGER,
  p_remarks         TEXT DEFAULT NULL,
  p_transfer_id     UUID DEFAULT NULL,
  p_stock_in_id     UUID DEFAULT NULL,
  p_invoice_id      UUID DEFAULT NULL,
  p_invoice_item_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta          INTEGER;
  v_balance_id     UUID;
  v_current_qty    INTEGER;
  v_new_qty        INTEGER;
  v_location_active BOOLEAN;
  v_product_active  BOOLEAN;
  v_product_name    TEXT;
  v_location_name   TEXT;
  v_ledger_id       UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_movement_type NOT IN (
    'STOCK_IN', 'TRANSFER_IN', 'TRANSFER_OUT', 'INVOICE_SALE', 'INVOICE_CANCEL'
  ) THEN
    RAISE EXCEPTION 'Invalid movement type: %', p_movement_type;
  END IF;

  SELECT is_active INTO v_location_active
    FROM public.stock_locations
    WHERE id = p_location_id;

  IF v_location_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Stock location is inactive or does not exist';
  END IF;

  SELECT is_active, name
    INTO v_product_active, v_product_name
    FROM public.products
    WHERE id = p_product_id;

  IF v_product_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Product is inactive or does not exist';
  END IF;

  SELECT name INTO v_location_name
    FROM public.stock_locations
    WHERE id = p_location_id;

  IF p_movement_type IN ('STOCK_IN', 'TRANSFER_IN', 'INVOICE_CANCEL') THEN
    v_delta := p_quantity;
  ELSE
    v_delta := -p_quantity;
  END IF;

  INSERT INTO public.stock_balances (location_id, product_id, quantity_on_hand)
  VALUES (p_location_id, p_product_id, 0)
  ON CONFLICT (location_id, product_id) DO NOTHING;

  SELECT id, quantity_on_hand
    INTO v_balance_id, v_current_qty
    FROM public.stock_balances
    WHERE location_id = p_location_id
      AND product_id = p_product_id
    FOR UPDATE;

  v_new_qty := v_current_qty + v_delta;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION
      'INSUFFICIENT_STOCK: Insufficient stock for "%" at "%". Available: %, required: %',
      v_product_name, v_location_name, v_current_qty, p_quantity;
  END IF;

  UPDATE public.stock_balances
    SET quantity_on_hand = v_new_qty,
        updated_at = NOW()
    WHERE id = v_balance_id;

  INSERT INTO public.inventory_ledger (
    movement_type,
    location_id,
    product_id,
    quantity,
    transfer_id,
    stock_in_id,
    invoice_id,
    invoice_item_id,
    remarks
  )
  VALUES (
    p_movement_type,
    p_location_id,
    p_product_id,
    p_quantity,
    p_transfer_id,
    p_stock_in_id,
    p_invoice_id,
    p_invoice_item_id,
    p_remarks
  )
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_inventory_movement(
  TEXT, UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(
  TEXT, UUID, UUID, INTEGER, TEXT, UUID, UUID, UUID, UUID
) TO authenticated;

-- ===========================================================================
-- 2. Stock in RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.stock_in(
  p_location_id UUID,
  p_product_id  UUID,
  p_quantity    INTEGER,
  p_remarks     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
BEGIN
  INSERT INTO public.stock_in_batches (location_id, remarks)
  VALUES (p_location_id, p_remarks)
  RETURNING id INTO v_batch_id;

  PERFORM public.apply_inventory_movement(
    'STOCK_IN',
    p_location_id,
    p_product_id,
    p_quantity,
    p_remarks,
    NULL,
    v_batch_id,
    NULL,
    NULL
  );

  RETURN v_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stock_in(UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_in(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- ===========================================================================
-- 3. Multi-line stock transfer RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_from_location_id UUID,
  p_to_location_id   UUID,
  p_lines            JSONB,
  p_remarks          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id UUID;
  v_line        JSONB;
  v_product_id  UUID;
  v_quantity    INTEGER;
BEGIN
  IF p_from_location_id = p_to_location_id THEN
    RAISE EXCEPTION 'From and to locations must be different';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one transfer line is required';
  END IF;

  INSERT INTO public.stock_transfers (from_location_id, to_location_id, remarks)
  VALUES (p_from_location_id, p_to_location_id, p_remarks)
  RETURNING id INTO v_transfer_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line ->> 'product_id')::UUID;
    v_quantity := (v_line ->> 'quantity')::INTEGER;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Each transfer line requires product_id and quantity > 0';
    END IF;

    INSERT INTO public.stock_transfer_lines (transfer_id, product_id, quantity)
    VALUES (v_transfer_id, v_product_id, v_quantity);

    PERFORM public.apply_inventory_movement(
      'TRANSFER_OUT',
      p_from_location_id,
      v_product_id,
      v_quantity,
      p_remarks,
      v_transfer_id,
      NULL,
      NULL,
      NULL
    );

    PERFORM public.apply_inventory_movement(
      'TRANSFER_IN',
      p_to_location_id,
      v_product_id,
      v_quantity,
      p_remarks,
      v_transfer_id,
      NULL,
      NULL,
      NULL
    );
  END LOOP;

  RETURN v_transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_stock(UUID, UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_stock(UUID, UUID, JSONB, TEXT) TO authenticated;

-- ===========================================================================
-- 4. Valuation helper
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_total_stock_valuation()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(sb.quantity_on_hand * p.price_50), 0)::NUMERIC
  FROM public.stock_balances AS sb
  INNER JOIN public.products AS p ON p.id = sb.product_id
  WHERE sb.quantity_on_hand > 0
    AND p.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_total_stock_valuation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_total_stock_valuation() TO authenticated;

-- ===========================================================================
-- 5. Invoice stock location column
-- ===========================================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stock_location_id UUID
    REFERENCES public.stock_locations (id) ON DELETE RESTRICT;

UPDATE public.invoices
SET stock_location_id = (
  SELECT id
  FROM public.stock_locations
  WHERE is_default = true
  ORDER BY sort_order ASC
  LIMIT 1
)
WHERE stock_location_id IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN stock_location_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_stock_location_id_idx
  ON public.invoices (stock_location_id);

-- ===========================================================================
-- 6. Invoice inventory triggers
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_invoice_item_inventory_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location_id UUID;
  v_status      TEXT;
BEGIN
  SELECT stock_location_id, status
    INTO v_location_id, v_status
    FROM public.invoices
    WHERE id = NEW.invoice_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice % does not exist', NEW.invoice_id;
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot add items to a cancelled invoice';
  END IF;

  PERFORM public.apply_inventory_movement(
    'INVOICE_SALE',
    v_location_id,
    NEW.product_id,
    NEW.quantity,
    NULL,
    NULL,
    NULL,
    NEW.invoice_id,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_inventory_sale ON public.invoice_items;
CREATE TRIGGER invoice_items_inventory_sale
  AFTER INSERT ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_item_inventory_sale();

CREATE OR REPLACE FUNCTION public.restore_invoice_inventory(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT id, product_id, quantity
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
  LOOP
    PERFORM public.apply_inventory_movement(
      'INVOICE_CANCEL',
      (SELECT stock_location_id FROM public.invoices WHERE id = p_invoice_id),
      v_item.product_id,
      v_item.quantity,
      'Invoice cancelled',
      NULL,
      NULL,
      p_invoice_id,
      v_item.id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_invoice_cancel_restore_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN
    PERFORM public.restore_invoice_inventory(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_cancel_restore_inventory ON public.invoices;
CREATE TRIGGER invoices_cancel_restore_inventory
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_cancel_restore_inventory();

COMMENT ON FUNCTION public.apply_inventory_movement IS
  'Single write path for stock_balances and inventory_ledger.';
COMMENT ON FUNCTION public.stock_in IS
  'Records a STOCK_IN batch and increases location stock.';
COMMENT ON FUNCTION public.transfer_stock IS
  'Creates a multi-line transfer document and moves stock between locations.';
COMMENT ON FUNCTION public.get_total_stock_valuation IS
  'Returns sum of quantity_on_hand * price_50 for active products.';
