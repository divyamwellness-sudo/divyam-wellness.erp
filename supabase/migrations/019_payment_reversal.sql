-- Divdev ERP — Payment reversal
-- Reverses payments via audit records without deleting payment history.
-- Safe to run multiple times (idempotent).

-- ===========================================================================
-- 1. Payment status metadata
-- ===========================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('POSTED', 'REVERSED'));

CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

-- ===========================================================================
-- 2. Payment reversal audit table
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.payment_reversals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  invoice_id      UUID NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT NOT NULL,
  payment_date    DATE NOT NULL,
  reference_num   TEXT,
  reversed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_by     UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  notes           TEXT,
  CONSTRAINT payment_reversals_payment_id_unique UNIQUE (payment_id)
);

CREATE INDEX IF NOT EXISTS payment_reversals_invoice_id_idx
  ON public.payment_reversals (invoice_id);

CREATE INDEX IF NOT EXISTS payment_reversals_reversed_at_idx
  ON public.payment_reversals (reversed_at DESC);

-- ===========================================================================
-- 3. Recompute invoice — count only POSTED payments
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
    WHERE invoice_id = p_invoice_id
      AND status = 'POSTED';

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
-- 4. Payment validation — exclude reversed payments from totals
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
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'REVERSED' THEN
      RAISE EXCEPTION 'Cannot modify a reversed payment';
    END IF;

    IF NEW.status = 'REVERSED'
      AND current_setting('app.allow_payment_reversal', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Payment reversals must use reverse_payment';
    END IF;
  END IF;

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
      AND id <> NEW.id
      AND status = 'POSTED';

  IF (v_other_paid + NEW.amount) > v_total THEN
    RAISE EXCEPTION
      'Payment exceeds amount due (invoice total %, already paid %, attempted %)',
      v_total, v_other_paid, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

-- ===========================================================================
-- 5. Never delete payment records
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.prevent_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Payment records cannot be deleted';
END;
$$;

DROP TRIGGER IF EXISTS payments_prevent_delete ON public.payments;
CREATE TRIGGER payments_prevent_delete
  BEFORE DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payment_delete();

-- ===========================================================================
-- 6. Reverse payment RPC
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.reverse_payment(
  p_payment_id UUID,
  p_notes      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment     public.payments%ROWTYPE;
  v_invoice_status TEXT;
  v_reversal_id UUID;
BEGIN
  SELECT *
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_payment.status = 'REVERSED' THEN
    RAISE EXCEPTION 'ALREADY_REVERSED: This payment has already been reversed';
  END IF;

  SELECT status
    INTO v_invoice_status
    FROM public.invoices
    WHERE id = v_payment.invoice_id;

  IF v_invoice_status IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot reverse payments on a cancelled invoice';
  END IF;

  INSERT INTO public.payment_reversals (
    payment_id,
    invoice_id,
    amount,
    payment_method,
    payment_date,
    reference_num,
    reversed_by,
    notes
  )
  VALUES (
    v_payment.id,
    v_payment.invoice_id,
    v_payment.amount,
    v_payment.payment_method,
    v_payment.payment_date,
    v_payment.reference_num,
    auth.uid(),
    p_notes
  )
  RETURNING id INTO v_reversal_id;

  PERFORM set_config('app.allow_payment_reversal', 'true', true);

  UPDATE public.payments
    SET status = 'REVERSED',
        reversed_at = NOW(),
        reversed_by = auth.uid()
    WHERE id = p_payment_id;

  RETURN v_reversal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_payment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_payment(UUID, TEXT) TO authenticated;

-- ===========================================================================
-- 7. RLS for payment_reversals (read-only for admins; writes via RPC)
-- ===========================================================================
ALTER TABLE public.payment_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_reversals_select_admin" ON public.payment_reversals;
CREATE POLICY "payment_reversals_select_admin"
  ON public.payment_reversals
  FOR SELECT
  TO authenticated
  USING (public.is_erp_admin());

COMMENT ON TABLE public.payment_reversals IS
  'Audit trail for reversed payments. Original payment rows are retained with status REVERSED.';
COMMENT ON FUNCTION public.reverse_payment IS
  'Marks a payment as reversed, writes an audit record, and recomputes invoice totals via trigger.';
