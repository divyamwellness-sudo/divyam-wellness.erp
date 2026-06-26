-- Divdev ERP — Quotations Module
-- Quotations and quotation line items, a separate business document from invoices.
--
-- Business rules enforced at the database level:
--   * Quotation is NOT an invoice: no inventory movement, no payment, no revenue.
--   * Separate atomic numbering sequence from business_settings.
--   * Status lifecycle: draft -> sent -> {accepted | rejected | expired | converted}.
--   * Only Draft quotations may be deleted.
--   * Customer + business snapshot is frozen at quotation time.
--   * Product name, SKU, unit price and unit VP are snapshotted onto items.
--   * subtotal, total_vp, total_amount are always derived by triggers.
--   * converted_invoice_id links to the invoice created from this quotation.
--
-- Fully idempotent: safe to run multiple times.

-- ===========================================================================
-- 1. Quotation numbering settings (added to business_settings)
-- ===========================================================================
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS quotation_prefix TEXT NOT NULL DEFAULT 'QT';

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS next_quotation_number INTEGER NOT NULL DEFAULT 1
    CHECK (next_quotation_number >= 1);

COMMENT ON COLUMN public.business_settings.quotation_prefix IS
  'Prefix used for quotation numbers, e.g. QT-2026-000001.';
COMMENT ON COLUMN public.business_settings.next_quotation_number IS
  'Next sequence number used for quotations (atomic, single-row lock).';

-- ===========================================================================
-- 2. quotations
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.quotations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number    TEXT NOT NULL,
  customer_id         UUID NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,

  -- Snapshotted membership data (frozen at quotation time; used for VP display rules)
  customer_type       TEXT NOT NULL CHECK (customer_type IN ('pc', 'coach')),
  pricing_tier        TEXT NOT NULL CHECK (pricing_tier IN ('MRP', '15', '25', '35', '42', '50')),

  -- Stock location snapshot (carried over on convert-to-invoice; never reserved here)
  stock_location_id   UUID NOT NULL REFERENCES public.stock_locations (id) ON DELETE RESTRICT,

  -- Derived financial figures (maintained by triggers)
  subtotal            NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total_vp            NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_vp >= 0),
  tax_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),

  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),

  quotation_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  notes               TEXT,
  terms               TEXT,

  -- Set when the quotation is converted into an invoice (one-way link).
  converted_invoice_id UUID REFERENCES public.invoices (id) ON DELETE SET NULL,
  converted_at         TIMESTAMPTZ,

  created_by          UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quotations_quotation_number_unique UNIQUE (quotation_number)
);

-- ===========================================================================
-- 3. quotation_items
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID NOT NULL REFERENCES public.quotations (id) ON DELETE CASCADE,
  -- Keep the line if the product is later removed; the snapshot stands alone.
  product_id      UUID REFERENCES public.products (id) ON DELETE SET NULL,

  -- Snapshotted product data (frozen at quotation time)
  product_name    TEXT NOT NULL,
  product_sku     TEXT NOT NULL,
  unit_price      NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  unit_vp         NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (unit_vp >= 0),

  quantity        INTEGER NOT NULL CHECK (quantity > 0),

  -- Derived line figures (generated, always consistent)
  line_total      NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  line_vp         NUMERIC(10, 2) GENERATED ALWAYS AS (unit_vp * quantity) STORED,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- 4. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS quotations_customer_id_idx       ON public.quotations (customer_id);
CREATE INDEX IF NOT EXISTS quotations_status_idx            ON public.quotations (status);
CREATE INDEX IF NOT EXISTS quotations_quotation_date_idx    ON public.quotations (quotation_date DESC);
CREATE INDEX IF NOT EXISTS quotations_valid_until_idx       ON public.quotations (valid_until);
CREATE INDEX IF NOT EXISTS quotations_converted_invoice_id_idx
  ON public.quotations (converted_invoice_id) WHERE converted_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotation_items_quotation_id_idx ON public.quotation_items (quotation_id);
CREATE INDEX IF NOT EXISTS quotation_items_product_id_idx   ON public.quotation_items (product_id);

-- ===========================================================================
-- 5. Quotation number generation (atomic, from business_settings)
-- Format: {quotation_prefix}-{YYYY}-{NNNNNN}, e.g. QT-2026-000001
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.generate_next_quotation_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings_id UUID;
  v_prefix      TEXT;
  v_number      INTEGER;
BEGIN
  SELECT id, quotation_prefix, next_quotation_number
    INTO v_settings_id, v_prefix, v_number
    FROM public.business_settings
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE;

  IF v_settings_id IS NULL THEN
    INSERT INTO public.business_settings (business_name)
    VALUES ('Divyam Wellness')
    RETURNING id, quotation_prefix, next_quotation_number
      INTO v_settings_id, v_prefix, v_number;
  END IF;

  UPDATE public.business_settings
    SET next_quotation_number = v_number + 1
    WHERE id = v_settings_id;

  RETURN v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_number::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_quotation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
    NEW.quotation_number := public.generate_next_quotation_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotations_set_quotation_number ON public.quotations;
CREATE TRIGGER quotations_set_quotation_number
  BEFORE INSERT ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quotation_number();

-- ===========================================================================
-- 6. updated_at trigger (reuses public.set_updated_at)
-- ===========================================================================
DROP TRIGGER IF EXISTS quotations_set_updated_at ON public.quotations;
CREATE TRIGGER quotations_set_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- 7. Central recompute: derives all financial figures for a quotation
-- Status is left untouched (status transitions are explicit app actions).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.recompute_quotation(p_quotation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal NUMERIC(12, 2);
  v_total_vp NUMERIC(10, 2);
  v_tax      NUMERIC(12, 2);
  v_total    NUMERIC(12, 2);
  v_exists   BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.quotations WHERE id = p_quotation_id)
    INTO v_exists;

  IF NOT v_exists THEN
    RETURN;
  END IF;

  SELECT tax_amount INTO v_tax
    FROM public.quotations
    WHERE id = p_quotation_id;

  SELECT COALESCE(SUM(line_total), 0), COALESCE(SUM(line_vp), 0)
    INTO v_subtotal, v_total_vp
    FROM public.quotation_items
    WHERE quotation_id = p_quotation_id;

  v_total := v_subtotal + COALESCE(v_tax, 0);

  UPDATE public.quotations
    SET subtotal     = v_subtotal,
        total_vp     = v_total_vp,
        total_amount = v_total,
        updated_at   = NOW()
    WHERE id = p_quotation_id;
END;
$$;

-- ===========================================================================
-- 8. Item sync trigger: keep quotation totals in step with its line items
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_quotation_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.quotations WHERE id = OLD.quotation_id) THEN
      PERFORM public.recompute_quotation(OLD.quotation_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.quotation_id IS DISTINCT FROM NEW.quotation_id THEN
    PERFORM public.recompute_quotation(OLD.quotation_id);
  END IF;

  PERFORM public.recompute_quotation(NEW.quotation_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_items_sync_quotation ON public.quotation_items;
CREATE TRIGGER quotation_items_sync_quotation
  AFTER INSERT OR UPDATE OR DELETE ON public.quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_quotation_item_change();

-- ===========================================================================
-- 9. Tax change sync (UPDATE on quotations.tax_amount doesn't fire item trigger)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_quotation_tax_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.tax_amount IS DISTINCT FROM NEW.tax_amount THEN
    PERFORM public.recompute_quotation(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotations_sync_tax ON public.quotations;
CREATE TRIGGER quotations_sync_tax
  AFTER UPDATE OF tax_amount ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_quotation_tax_change();

-- ===========================================================================
-- 10. Guard: only Draft quotations accept item changes
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.validate_quotation_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.quotations WHERE id = NEW.quotation_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Quotation % does not exist', NEW.quotation_id;
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Cannot modify items on a quotation that is not a draft (status: %)', v_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotation_items_validate ON public.quotation_items;
CREATE TRIGGER quotation_items_validate
  BEFORE INSERT OR UPDATE ON public.quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quotation_item();

-- ===========================================================================
-- 11. Guard: status transitions for quotations
--   * draft  -> sent | accepted | rejected | expired
--   * sent   -> accepted | rejected | expired | draft
--   * accepted/rejected/expired -> converted (only when converting)
--   * converted is terminal (cannot revert)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.validate_quotation_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := 'draft';
    END IF;
    IF NEW.status NOT IN ('draft', 'sent', 'accepted', 'rejected', 'expired') THEN
      RAISE EXCEPTION 'Invalid initial quotation status: %', NEW.status;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'converted' THEN
    RAISE EXCEPTION 'A converted quotation cannot change status';
  END IF;

  IF NEW.status = 'converted' THEN
    -- Conversion is allowed from any non-converted status.
    IF NEW.converted_invoice_id IS NULL THEN
      RAISE EXCEPTION 'converted status requires converted_invoice_id';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotations_validate_status ON public.quotations;
CREATE TRIGGER quotations_validate_status
  BEFORE INSERT OR UPDATE OF status ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quotation_status_transition();

-- ===========================================================================
-- 12. RLS policies (admin-only, matching production hardening)
-- ===========================================================================
ALTER TABLE public.quotations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- quotations
DROP POLICY IF EXISTS "quotations_select_admin" ON public.quotations;
DROP POLICY IF EXISTS "quotations_insert_admin" ON public.quotations;
DROP POLICY IF EXISTS "quotations_update_admin" ON public.quotations;
DROP POLICY IF EXISTS "quotations_delete_admin" ON public.quotations;

CREATE POLICY "quotations_select_admin"
  ON public.quotations FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "quotations_insert_admin"
  ON public.quotations FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "quotations_update_admin"
  ON public.quotations FOR UPDATE TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

-- Quotations may only be deleted when they are still Draft.
CREATE POLICY "quotations_delete_admin"
  ON public.quotations FOR DELETE TO authenticated
  USING (
    public.is_erp_admin()
    AND status = 'draft'
  );

-- quotation_items
DROP POLICY IF EXISTS "quotation_items_select_admin" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_insert_admin" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_update_admin" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_delete_admin" ON public.quotation_items;

CREATE POLICY "quotation_items_select_admin"
  ON public.quotation_items FOR SELECT TO authenticated
  USING (public.is_erp_admin());

CREATE POLICY "quotation_items_insert_admin"
  ON public.quotation_items FOR INSERT TO authenticated
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "quotation_items_update_admin"
  ON public.quotation_items FOR UPDATE TO authenticated
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

CREATE POLICY "quotation_items_delete_admin"
  ON public.quotation_items FOR DELETE TO authenticated
  USING (public.is_erp_admin());

-- ===========================================================================
-- 13. RPC: convert quotation to invoice (single server-side transaction)
--   * Copies customer, stock location, items, tax and notes into a new invoice.
--   * Inventory deduction happens via the existing invoice_items insert trigger.
--   * Marks the quotation as 'converted' and links converted_invoice_id.
--   * Returns the new invoice id.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.convert_quotation_to_invoice(p_quotation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotation     RECORD;
  v_invoice_id    UUID;
  v_items_to_copy RECORD;
  v_items_count   INTEGER := 0;
BEGIN
  SELECT * INTO v_quotation
    FROM public.quotations
    WHERE id = p_quotation_id
    FOR UPDATE;

  IF v_quotation IS NULL THEN
    RAISE EXCEPTION 'Quotation % does not exist', p_quotation_id;
  END IF;

  IF v_quotation.status = 'converted' THEN
    RAISE EXCEPTION 'Quotation % is already converted', v_quotation.quotation_number;
  END IF;

  SELECT COUNT(*) INTO v_items_count
    FROM public.quotation_items
    WHERE quotation_id = p_quotation_id;

  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'Cannot convert a quotation with no items';
  END IF;

  -- 1. Insert invoice header (number/totals/status are DB-managed).
  INSERT INTO public.invoices (
    customer_id,
    customer_type,
    pricing_tier,
    stock_location_id,
    tax_amount,
    invoice_date,
    due_date,
    notes
  )
  VALUES (
    v_quotation.customer_id,
    v_quotation.customer_type,
    v_quotation.pricing_tier,
    v_quotation.stock_location_id,
    v_quotation.tax_amount,
    CURRENT_DATE,
    CURRENT_DATE + 30,
    v_quotation.notes
  )
  RETURNING id INTO v_invoice_id;

  -- 2. Copy line items. The invoice_items inventory trigger deducts stock now.
  FOR v_items_to_copy IN
    SELECT product_id, product_name, product_sku, unit_price, unit_vp, quantity
    FROM public.quotation_items
    WHERE quotation_id = p_quotation_id
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id,
      product_id,
      product_name,
      product_sku,
      unit_price,
      unit_vp,
      quantity
    )
    VALUES (
      v_invoice_id,
      v_items_to_copy.product_id,
      v_items_to_copy.product_name,
      v_items_to_copy.product_sku,
      v_items_to_copy.unit_price,
      v_items_to_copy.unit_vp,
      v_items_to_copy.quantity
    );
  END LOOP;

  -- 3. Mark quotation as converted.
  UPDATE public.quotations
    SET status               = 'converted',
        converted_invoice_id = v_invoice_id,
        converted_at         = NOW()
    WHERE id = p_quotation_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_quotation_to_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_quotation_to_invoice(UUID) TO authenticated;

-- ===========================================================================
-- 14. Documentation
-- ===========================================================================
COMMENT ON TABLE public.quotations IS
  'Customer quotations. Separate from invoices: no inventory, payment or revenue.';
COMMENT ON TABLE public.quotation_items IS
  'Quotation line items with snapshotted product name, SKU, unit price and unit VP.';
COMMENT ON COLUMN public.quotations.customer_type IS
  'Snapshot of customer.customer_type at quotation time; drives VP display rules.';
COMMENT ON COLUMN public.quotations.pricing_tier IS
  'Snapshot of customer.pricing_tier at quotation time; carried into invoice on convert.';
COMMENT ON COLUMN public.quotations.stock_location_id IS
  'Stock location that will be used when the quotation is converted to an invoice.';
COMMENT ON COLUMN public.quotations.valid_until IS
  'Date until which the quotation remains valid.';
COMMENT ON COLUMN public.quotations.converted_invoice_id IS
  'Invoice created from this quotation, set during conversion.';
COMMENT ON COLUMN public.quotation_items.line_total IS
  'Generated: unit_price * quantity.';
COMMENT ON COLUMN public.quotation_items.line_vp IS
  'Generated: unit_vp * quantity.';
COMMENT ON FUNCTION public.generate_next_quotation_number() IS
  'Atomically issues the next quotation number from business_settings.';
COMMENT ON FUNCTION public.recompute_quotation(UUID) IS
  'Recomputes subtotal, VP and total for a quotation.';
COMMENT ON FUNCTION public.convert_quotation_to_invoice(UUID) IS
  'Converts a quotation into an invoice in a single transaction, deducting stock.';
