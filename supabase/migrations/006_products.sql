-- Divyam Wellness ERP — Phase 3: Products Module
-- Creates the products catalog with absolute per-tier pricing.
--
-- Pricing model: price is keyed by TIER VALUE alone.
--   MRP -> mrp_price
--   15  -> price_15
--   25  -> price_25   (PC 25 and Coach 25 share this price)
--   35  -> price_35   (PC 35 and Coach 35 share this price)
--   42  -> price_42
--   50  -> price_50
-- customer_type only constrains which tiers are selectable; it never affects
-- which column is used for the price.
--
-- All tier price columns are NOT NULL (no fallback logic): every product must
-- carry an explicit price for every tier.
--
-- Fully idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. products table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  sku            TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'other',
  mrp_price      NUMERIC(10, 2) NOT NULL,
  price_15       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_25       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_35       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_42       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_50       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  volume_points  NUMERIC(8, 2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_sku_unique UNIQUE (sku)
);

-- ---------------------------------------------------------------------------
-- 2. Validation constraints (DROP/ADD pattern keeps them re-runnable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check,
  DROP CONSTRAINT IF EXISTS products_mrp_price_check,
  DROP CONSTRAINT IF EXISTS products_price_15_check,
  DROP CONSTRAINT IF EXISTS products_price_25_check,
  DROP CONSTRAINT IF EXISTS products_price_35_check,
  DROP CONSTRAINT IF EXISTS products_price_42_check,
  DROP CONSTRAINT IF EXISTS products_price_50_check,
  DROP CONSTRAINT IF EXISTS products_volume_points_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
    CHECK (category IN (
      'shakes',
      'protein',
      'tea_energy',
      'supplements',
      'vitamins',
      'skincare',
      'accessories',
      'other'
    )),
  ADD CONSTRAINT products_mrp_price_check      CHECK (mrp_price > 0),
  ADD CONSTRAINT products_price_15_check       CHECK (price_15 >= 0),
  ADD CONSTRAINT products_price_25_check       CHECK (price_25 >= 0),
  ADD CONSTRAINT products_price_35_check       CHECK (price_35 >= 0),
  ADD CONSTRAINT products_price_42_check       CHECK (price_42 >= 0),
  ADD CONSTRAINT products_price_50_check       CHECK (price_50 >= 0),
  ADD CONSTRAINT products_volume_points_check  CHECK (volume_points >= 0);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS products_is_active_idx ON public.products (is_active);
CREATE INDEX IF NOT EXISTS products_category_idx  ON public.products (category);
CREATE INDEX IF NOT EXISTS products_sku_idx       ON public.products (sku);
CREATE INDEX IF NOT EXISTS products_name_idx      ON public.products (name);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger (reuses public.set_updated_at from Phase 1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Price resolver (server-side hook for the future Billing module)
-- Returns the price for a given tier value. No fallback: a bad tier yields NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_price(p_product_id UUID, p_tier TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_tier
    WHEN 'MRP' THEN mrp_price
    WHEN '15'  THEN price_15
    WHEN '25'  THEN price_25
    WHEN '35'  THEN price_35
    WHEN '42'  THEN price_42
    WHEN '50'  THEN price_50
  END
  FROM public.products
  WHERE id = p_product_id;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS policies (authenticated CRUD, matching customers/weight_logs)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_update_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_delete_authenticated" ON public.products;

CREATE POLICY "products_select_authenticated"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "products_insert_authenticated"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "products_update_authenticated"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "products_delete_authenticated"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 7. Documentation
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.products IS 'Product catalog with absolute per-tier pricing.';
COMMENT ON COLUMN public.products.mrp_price IS 'Price for the MRP tier.';
COMMENT ON COLUMN public.products.price_25 IS 'Price for tier 25 (shared by PC 25 and Coach 25).';
COMMENT ON COLUMN public.products.price_35 IS 'Price for tier 35 (shared by PC 35 and Coach 35).';
COMMENT ON COLUMN public.products.volume_points IS 'Volume Points (VP) for Herbalife business calculations.';
COMMENT ON FUNCTION public.get_product_price(UUID, TEXT) IS 'Resolves a product price by tier value for invoicing.';