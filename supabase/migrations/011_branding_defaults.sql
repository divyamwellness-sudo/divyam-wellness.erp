-- Divdev ERP — Branding defaults update
-- Safe to run multiple times (idempotent).

-- ---------------------------------------------------------------------------
-- 1. Migrate legacy business name values
-- ---------------------------------------------------------------------------
UPDATE public.business_settings
SET business_name = 'Divdev Infotech'
WHERE business_name = 'Divyam Wellness';

ALTER TABLE public.business_settings
  ALTER COLUMN business_name SET DEFAULT 'Divdev Infotech';

-- ---------------------------------------------------------------------------
-- 2. Update invoice number generator fallback business name
-- ---------------------------------------------------------------------------
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
  SELECT id, invoice_prefix, next_invoice_number
    INTO v_settings_id, v_prefix, v_number
    FROM public.business_settings
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE;

  IF v_settings_id IS NULL THEN
    INSERT INTO public.business_settings (business_name)
    VALUES ('Divdev Infotech')
    RETURNING id, invoice_prefix, next_invoice_number
      INTO v_settings_id, v_prefix, v_number;
  END IF;

  UPDATE public.business_settings
    SET next_invoice_number = v_number + 1
    WHERE id = v_settings_id;

  RETURN v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_number::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_next_invoice_number() IS
  'Atomically issues the next invoice number from business_settings.';
