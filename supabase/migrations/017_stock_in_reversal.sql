-- Divdev ERP — Stock In reversal (Phase 1.5)
-- Safe to run multiple times (idempotent).

-- ===========================================================================
-- 1. Stock in batch metadata
-- ===========================================================================
ALTER TABLE public.stock_in_batches
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.stock_in_batches
  DROP CONSTRAINT IF EXISTS stock_in_batches_status_check;

ALTER TABLE public.stock_in_batches
  ADD CONSTRAINT stock_in_batches_status_check
  CHECK (status IN ('POSTED', 'REVERSED'));

CREATE UNIQUE INDEX IF NOT EXISTS stock_in_batches_reference_number_unique_idx
  ON public.stock_in_batches (reference_number)
  WHERE reference_number IS NOT NULL;

-- ===========================================================================
-- 2. Reference number sequence
-- ===========================================================================
CREATE SEQUENCE IF NOT EXISTS public.stock_in_reference_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_next_stock_in_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  v_next := nextval('public.stock_in_reference_seq');
  RETURN 'SI-' || lpad(v_next::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_stock_in_reference() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_next_stock_in_reference() TO authenticated;

-- Backfill reference numbers for existing batches
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.stock_in_batches
  WHERE reference_number IS NULL
)
UPDATE public.stock_in_batches AS b
SET reference_number = 'SI-' || lpad(n.rn::text, 5, '0')
FROM numbered AS n
WHERE b.id = n.id;

SELECT setval(
  'public.stock_in_reference_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX(CAST(substring(reference_number FROM 4) AS BIGINT))
        FROM public.stock_in_batches
        WHERE reference_number ~ '^SI-[0-9]+$'
      ),
      0
    ),
    1
  ),
  true
);

-- ===========================================================================
-- 3. Ledger movement type: STOCK_IN_REVERSAL
-- ===========================================================================
ALTER TABLE public.inventory_ledger
  DROP CONSTRAINT IF EXISTS inventory_ledger_movement_type_check;

ALTER TABLE public.inventory_ledger
  ADD CONSTRAINT inventory_ledger_movement_type_check CHECK (
    movement_type IN (
      'STOCK_IN',
      'STOCK_IN_REVERSAL',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'INVOICE_SALE',
      'INVOICE_CANCEL'
    )
  );

-- ===========================================================================
-- 4. Movement engine — support STOCK_IN_REVERSAL
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
    'STOCK_IN',
    'STOCK_IN_REVERSAL',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'INVOICE_SALE',
    'INVOICE_CANCEL'
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

-- ===========================================================================
-- 5. Stock in RPC — assign reference number
-- ===========================================================================
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
  v_reference  TEXT;
  v_line       JSONB;
  v_product_id UUID;
  v_quantity   INTEGER;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'At least one stock in line is required';
  END IF;

  v_reference := public.generate_next_stock_in_reference();

  INSERT INTO public.stock_in_batches (location_id, remarks, reference_number, status)
  VALUES (p_location_id, p_remarks, v_reference, 'POSTED')
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

-- ===========================================================================
-- 6. Reverse stock in RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.reverse_stock_in(p_batch_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.stock_in_batches%ROWTYPE;
  v_line  RECORD;
BEGIN
  SELECT *
    INTO v_batch
    FROM public.stock_in_batches
    WHERE id = p_batch_id
    FOR UPDATE;

  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Stock in batch not found';
  END IF;

  IF v_batch.status = 'REVERSED' THEN
    RAISE EXCEPTION 'ALREADY_REVERSED: Stock in % has already been reversed', v_batch.reference_number;
  END IF;

  FOR v_line IN
    SELECT product_id, quantity
    FROM public.stock_in_lines
    WHERE batch_id = p_batch_id
  LOOP
    PERFORM public.apply_inventory_movement(
      'STOCK_IN_REVERSAL',
      v_batch.location_id,
      v_line.product_id,
      v_line.quantity,
      'Reversal of ' || v_batch.reference_number,
      NULL,
      p_batch_id,
      NULL,
      NULL
    );
  END LOOP;

  UPDATE public.stock_in_batches
    SET status = 'REVERSED',
        reversed_at = NOW(),
        reversed_by = auth.uid()
    WHERE id = p_batch_id;

  RETURN p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_stock_in(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_stock_in(UUID) TO authenticated;

COMMENT ON FUNCTION public.reverse_stock_in IS
  'Reverses a posted stock in batch via STOCK_IN_REVERSAL ledger entries without deleting history.';
