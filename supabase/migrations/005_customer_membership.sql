-- Divyam Wellness ERP — Phase 2.2: Customer Membership Structure
-- Introduces customer_type (pc / coach) and rebuilds the pricing tier rules
-- so that the selectable tier set depends on the membership type.
--
-- Pricing note: tier VALUE alone determines product price.
--   PC 25 and Coach 25 share the same price.
--   PC 35 and Coach 35 share the same price.
-- customer_type only constrains which tiers are valid for a customer.
--
-- Tier validity matrix:
--   pc    -> MRP, 15, 25, 35
--   coach -> MRP, 25, 35, 42, 50
--
-- Fully idempotent: safe to run multiple times.
-- Backward compatible: existing rows default to 'coach', which permits all
-- previously-allowed tiers (MRP, 25, 35, 42, 50), so no existing row breaks.

-- ---------------------------------------------------------------------------
-- 1. customer_type column
-- Defaulting existing rows to 'coach' keeps every legacy tier value valid.
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'coach';

-- ---------------------------------------------------------------------------
-- 2. customer_type domain check
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_customer_type_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_customer_type_check
    CHECK (customer_type IN ('pc', 'coach'));

-- ---------------------------------------------------------------------------
-- 3. Replace the old pricing tier check with a type-aware constraint
-- The original inline constraint from migration 002 was named
-- customers_pricing_tier_check (Postgres auto-name for an inline CHECK).
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_pricing_tier_check;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_pricing_tier_type_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_pricing_tier_type_check
    CHECK (
      (customer_type = 'pc'    AND pricing_tier IN ('MRP', '15', '25', '35'))
      OR
      (customer_type = 'coach' AND pricing_tier IN ('MRP', '25', '35', '42', '50'))
    );

-- ---------------------------------------------------------------------------
-- 4. Index for filtering by membership type
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS customers_customer_type_idx
  ON public.customers (customer_type);

-- ---------------------------------------------------------------------------
-- 5. Documentation
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.customers.customer_type IS
  'Membership type: pc (Preferred Customer) or coach (Distributor). Constrains valid pricing_tier values.';
COMMENT ON COLUMN public.customers.pricing_tier IS
  'Discount tier. Price is keyed by this value alone (PC 25 = Coach 25, PC 35 = Coach 35). Valid set depends on customer_type.';