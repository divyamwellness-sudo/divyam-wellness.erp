-- Divyam Wellness ERP — Phase 2: Customers & Weight Logs
-- Requires Phase 1 migration (public.set_updated_at function)

-- ---------------------------------------------------------------------------
-- 1. customers
-- ---------------------------------------------------------------------------
CREATE TABLE public.customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  whatsapp_number  TEXT,
  email            TEXT,
  gender           TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  date_of_birth    DATE,
  city             TEXT,
  address          TEXT,
  joining_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  height_cm        NUMERIC(5, 1) CHECK (height_cm IS NULL OR height_cm > 0),
  starting_weight  NUMERIC(5, 2) CHECK (starting_weight IS NULL OR starting_weight > 0),
  current_weight   NUMERIC(5, 2) CHECK (current_weight IS NULL OR current_weight > 0),
  target_weight    NUMERIC(5, 2) CHECK (target_weight IS NULL OR target_weight > 0),
  goal             TEXT CHECK (
    goal IS NULL OR goal IN (
      'weight_loss',
      'weight_gain',
      'maintenance',
      'muscle_gain',
      'general_wellness'
    )
  ),
  pricing_tier     TEXT NOT NULL DEFAULT '35' CHECK (
    pricing_tier IN ('MRP', '25', '35', '42', '50')
  ),
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by       UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_phone_unique UNIQUE (phone),
  CONSTRAINT customers_whatsapp_unique UNIQUE (whatsapp_number)
);

-- ---------------------------------------------------------------------------
-- 2. weight_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.weight_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          UUID NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  weight_kg            NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0),
  body_fat_percentage  NUMERIC(5, 2) CHECK (
    body_fat_percentage IS NULL OR (
      body_fat_percentage >= 0 AND body_fat_percentage <= 100
    )
  ),
  recorded_date        DATE NOT NULL,
  notes                TEXT,
  created_by           UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weight_logs_customer_date_unique UNIQUE (customer_id, recorded_date)
);

-- ---------------------------------------------------------------------------
-- 3. indexes
-- ---------------------------------------------------------------------------
CREATE INDEX customers_status_idx ON public.customers (status);
CREATE INDEX customers_pricing_tier_idx ON public.customers (pricing_tier);
CREATE INDEX customers_city_idx ON public.customers (city);
CREATE INDEX customers_joining_date_idx ON public.customers (joining_date DESC);
CREATE INDEX customers_name_idx ON public.customers (name);

CREATE INDEX weight_logs_customer_id_idx ON public.weight_logs (customer_id);
CREATE INDEX weight_logs_recorded_date_idx ON public.weight_logs (customer_id, recorded_date DESC);

-- ---------------------------------------------------------------------------
-- 4. triggers
-- ---------------------------------------------------------------------------

-- customers.updated_at
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- weight_logs → customers.starting_weight / current_weight sync
CREATE OR REPLACE FUNCTION public.sync_customer_weight_from_logs(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_weight NUMERIC(5, 2);
  v_log_count     INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_log_count
  FROM public.weight_logs AS wl
  WHERE wl.customer_id = p_customer_id;

  IF v_log_count = 0 THEN
    -- No weight logs remain: clear current_weight explicitly.
    -- starting_weight is intentionally preserved as the enrollment baseline.
    UPDATE public.customers
    SET
      current_weight = NULL,
      updated_at = NOW()
    WHERE id = p_customer_id;

    RETURN;
  END IF;

  SELECT wl.weight_kg
  INTO v_latest_weight
  FROM public.weight_logs AS wl
  WHERE wl.customer_id = p_customer_id
  ORDER BY wl.recorded_date DESC, wl.created_at DESC
  LIMIT 1;

  UPDATE public.customers
  SET
    current_weight = v_latest_weight,
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_weight_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.customers
    SET
      starting_weight = COALESCE(starting_weight, NEW.weight_kg),
      current_weight = NEW.weight_kg,
      updated_at = NOW()
    WHERE id = NEW.customer_id;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      PERFORM public.sync_customer_weight_from_logs(OLD.customer_id);
    END IF;

    PERFORM public.sync_customer_weight_from_logs(NEW.customer_id);

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_customer_weight_from_logs(OLD.customer_id);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER weight_logs_sync_customer_weight
  AFTER INSERT OR UPDATE OR DELETE ON public.weight_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_weight_log_change();

-- ---------------------------------------------------------------------------
-- 5. RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_authenticated"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "customers_insert_authenticated"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customers_update_authenticated"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customers_delete_authenticated"
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_select_authenticated"
  ON public.weight_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_insert_authenticated"
  ON public.weight_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_update_authenticated"
  ON public.weight_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "weight_logs_delete_authenticated"
  ON public.weight_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
