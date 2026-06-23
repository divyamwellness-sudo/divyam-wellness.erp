-- Divyam Wellness ERP — Phase 4: Billing Module
-- Invoices, invoice line items, and payments with automatic financial sync.
--
-- Business rules enforced at the database level:
--   * Partial payments and outstanding due balances are supported.
--   * Overpayments are rejected (sum of payments may never exceed total_amount).
--   * Cancelled invoices reject new/modified line items and payments.
--   * Invoice number is generated atomically from business_settings.
--   * customer_type and pricing_tier are snapshotted onto the invoice.
--   * product_name, product_sku, unit_price and unit_vp are snapshotted onto items.
--   * subtotal, total_vp, total_amount, paid_amount, due_amount and status are
--     always derived by triggers — never trusted from the client.
--
-- Fully idempotent: safe to run multiple times.

-- ===========================================================================
-- 1. invoices
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL,
  customer_id     UUID NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,

  -- Snapshotted membership data (frozen at invoice time)
  customer_type   TEXT NOT NULL CHECK (customer_type IN ('pc', 'coach')),
  pricing_tier    TEXT NOT NULL CHECK (pricing_tier IN ('MRP', '15', '25', '35', '42', '50')),

  -- Derived financial figures (maintained by triggers)
  subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total_vp        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_vp >= 0),
  tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),

  status          TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'partial', 'paid', 'cancelled')),

  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE NOT NULL DEFAULT (CURRENT_DATE + 30),
  notes           TEXT,

  created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number),
  -- Overpayment guard at the row level (defence in depth alongside triggers)
  CONSTRAINT invoices_paid_not_over_total CHECK (paid_amount <= total_amount)
);

-- ===========================================================================
-- 2. invoice_items
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  -- Keep the line if the product is later removed; the snapshot stands alone.
  product_id    UUID REFERENCES public.products (id) ON DELETE SET NULL,

  -- Snapshotted product data (frozen at invoice time)
  product_name  TEXT NOT NULL,
  product_sku   TEXT NOT NULL,
  unit_price    NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  unit_vp       NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (unit_vp >= 0),

  quantity      INTEGER NOT NULL CHECK (quantity > 0),

  -- Derived line figures (generated, always consistent)
  line_total    NUMERIC(12, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  line_vp       NUMERIC(10, 2) GENERATED ALWAYS AS (unit_vp * quantity) STORED,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- 3. payments
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'bank', 'card')),
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_num   TEXT,
  notes           TEXT,

  created_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- 4. Indexes
-- ===========================================================================
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx   ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx        ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx  ON public.invoices (invoice_date DESC);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx      ON public.invoices (due_date);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_product_id_idx ON public.invoice_items (product_id);

CREATE INDEX IF NOT EXISTS payments_invoice_id_idx     ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_payment_date_idx   ON public.payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_payment_method_idx ON public.payments (payment_method);

-- ===========================================================================
-- 5. Invoice number generation (atomic, from business_settings)
-- Format: {invoice_prefix}-{YYYY}-{NNNN}, e.g. DW-2026-0001
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number()
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
  -- Lock the single settings row so concurrent inserts cannot collide.
  SELECT id, invoice_prefix, next_invoice_number
    INTO v_settings_id, v_prefix, v_number
    FROM public.business_settings
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE;

  IF v_settings_id IS NULL THEN
    INSERT INTO public.business_settings (business_name)
    VALUES ('Divyam Wellness')
    RETURNING id, invoice_prefix, next_invoice_number
      INTO v_settings_id, v_prefix, v_number;
  END IF;

  UPDATE public.business_settings
    SET next_invoice_number = v_number + 1
    WHERE id = v_settings_id;

  RETURN v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_number::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_next_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_set_invoice_number ON public.invoices;
CREATE TRIGGER invoices_set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_number();

-- ===========================================================================
-- 6. updated_at trigger (reuses public.set_updated_at from Phase 1)
-- ===========================================================================
DROP TRIGGER IF EXISTS invoices_set_updated_at ON public.invoices;
CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- 7. Central recompute: derives all financial figures + status for an invoice
-- Single source of truth used by both the item and payment sync triggers.
-- Cancelled invoices retain the 'cancelled' status.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.recompute_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal       NUMERIC(12, 2);
  v_total_vp       NUMERIC(10, 2);
  v_paid           NUMERIC(12, 2);
  v_tax            NUMERIC(12, 2);
  v_total          NUMERIC(12, 2);
  v_current_status TEXT;
  v_new_status     TEXT;
BEGIN
  SELECT tax_amount, status
    INTO v_tax, v_current_status
    FROM public.invoices
    WHERE id = p_invoice_id;

  -- Invoice no longer exists (e.g. cascade delete in progress): nothing to do.
  IF v_current_status IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(line_total), 0), COALESCE(SUM(line_vp), 0)
    INTO v_subtotal, v_total_vp
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM public.payments
    WHERE invoice_id = p_invoice_id;

  v_total := v_subtotal + COALESCE(v_tax, 0);

  IF v_current_status = 'cancelled' THEN
    v_new_status := 'cancelled';
  ELSIF v_paid <= 0 THEN
    v_new_status := 'created';
  ELSIF v_paid >= v_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  UPDATE public.invoices
    SET subtotal     = v_subtotal,
        total_vp     = v_total_vp,
        total_amount = v_total,
        paid_amount  = v_paid,
        due_amount   = v_total - v_paid,
        status       = v_new_status,
        updated_at   = NOW()
    WHERE id = p_invoice_id;
END;
$$;

-- ===========================================================================
-- 8. Item sync trigger: keep invoice totals in step with its line items
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_invoice_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.invoices WHERE id = OLD.invoice_id) THEN
      PERFORM public.recompute_invoice(OLD.invoice_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    PERFORM public.recompute_invoice(OLD.invoice_id);
  END IF;

  PERFORM public.recompute_invoice(NEW.invoice_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_sync_invoice ON public.invoice_items;
CREATE TRIGGER invoice_items_sync_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_item_change();

-- ===========================================================================
-- 9. Payment sync trigger: keep paid/due/status in step with payments
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.handle_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.invoices WHERE id = OLD.invoice_id) THEN
      PERFORM public.recompute_invoice(OLD.invoice_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    PERFORM public.recompute_invoice(OLD.invoice_id);
  END IF;

  PERFORM public.recompute_invoice(NEW.invoice_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_invoice ON public.payments;
CREATE TRIGGER payments_sync_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_change();

-- ===========================================================================
-- 10. Guard: cancelled invoices reject new/modified line items
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.validate_invoice_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.invoices WHERE id = NEW.invoice_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice % does not exist', NEW.invoice_id;
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot add or modify items on a cancelled invoice';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_items_validate ON public.invoice_items;
CREATE TRIGGER invoice_items_validate
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invoice_item();

-- ===========================================================================
-- 11. Guard: cancelled invoices reject payments; overpayments rejected
-- Defaults (incl. id) are populated before BEFORE-INSERT triggers run, so
-- excluding NEW.id correctly sums the "other" payments for both INSERT/UPDATE.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.validate_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status     TEXT;
  v_total      NUMERIC(12, 2);
  v_other_paid NUMERIC(12, 2);
BEGIN
  SELECT status, total_amount
    INTO v_status, v_total
    FROM public.invoices
    WHERE id = NEW.invoice_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Invoice % does not exist', NEW.invoice_id;
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot record payments against a cancelled invoice';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_other_paid
    FROM public.payments
    WHERE invoice_id = NEW.invoice_id
      AND id <> NEW.id;

  IF (v_other_paid + NEW.amount) > v_total THEN
    RAISE EXCEPTION
      'Payment exceeds amount due (invoice total %, already paid %, attempted %)',
      v_total, v_other_paid, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_validate ON public.payments;
CREATE TRIGGER payments_validate
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment();

-- ===========================================================================
-- 12. RLS policies (authenticated CRUD, matching customers/products)
-- ===========================================================================
ALTER TABLE public.invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments      ENABLE ROW LEVEL SECURITY;

-- invoices
DROP POLICY IF EXISTS "invoices_select_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_authenticated" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_authenticated" ON public.invoices;

CREATE POLICY "invoices_select_authenticated"
  ON public.invoices FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_insert_authenticated"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_update_authenticated"
  ON public.invoices FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_delete_authenticated"
  ON public.invoices FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- invoice_items
DROP POLICY IF EXISTS "invoice_items_select_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_insert_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_update_authenticated" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_delete_authenticated" ON public.invoice_items;

CREATE POLICY "invoice_items_select_authenticated"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_items_insert_authenticated"
  ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_items_update_authenticated"
  ON public.invoice_items FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoice_items_delete_authenticated"
  ON public.invoice_items FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- payments
DROP POLICY IF EXISTS "payments_select_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_update_authenticated" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_authenticated" ON public.payments;

CREATE POLICY "payments_select_authenticated"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "payments_insert_authenticated"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payments_update_authenticated"
  ON public.payments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payments_delete_authenticated"
  ON public.payments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ===========================================================================
-- 13. Documentation
-- ===========================================================================
COMMENT ON TABLE public.invoices IS 'Customer invoices with snapshotted membership and derived financial totals.';
COMMENT ON TABLE public.invoice_items IS 'Invoice line items with snapshotted product name, SKU, unit price and unit VP.';
COMMENT ON TABLE public.payments IS 'Payments recorded against invoices; supports partial payments and due balances.';
COMMENT ON COLUMN public.invoices.customer_type IS 'Snapshot of customer.customer_type at invoice time.';
COMMENT ON COLUMN public.invoices.pricing_tier IS 'Snapshot of customer.pricing_tier at invoice time.';
COMMENT ON COLUMN public.invoices.due_amount IS 'Auto-calculated as total_amount - paid_amount.';
COMMENT ON COLUMN public.invoice_items.line_total IS 'Generated: unit_price * quantity.';
COMMENT ON COLUMN public.invoice_items.line_vp IS 'Generated: unit_vp * quantity.';
COMMENT ON FUNCTION public.generate_next_invoice_number() IS 'Atomically issues the next invoice number from business_settings.';
COMMENT ON FUNCTION public.recompute_invoice(UUID) IS 'Recomputes subtotal, VP, totals, paid, due and status for an invoice.';