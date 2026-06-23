-- Divyam Wellness ERP — Phase 2.1: Body Composition Metrics
-- Extends weight_logs with additional body composition fields.
-- Fully idempotent: safe to run multiple times.
-- Backward compatible: all new columns are nullable; existing rows are unaffected.
-- Does NOT modify the customers table, services, UI, or forms.

-- ---------------------------------------------------------------------------
-- New body composition columns on weight_logs
-- ADD COLUMN IF NOT EXISTS is natively idempotent.
-- ---------------------------------------------------------------------------
ALTER TABLE public.weight_logs
  ADD COLUMN IF NOT EXISTS bmi            NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS visceral_fat   NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS muscle_mass    NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS bmr            NUMERIC(7, 2),
  ADD COLUMN IF NOT EXISTS metabolic_age  INTEGER,
  ADD COLUMN IF NOT EXISTS tsf            NUMERIC(5, 2);

-- ---------------------------------------------------------------------------
-- Validation constraints (non-negative)
-- DROP IF EXISTS before ADD makes constraint creation re-runnable.
-- Existing NULLs always pass these checks (backward compatible).
-- ---------------------------------------------------------------------------
ALTER TABLE public.weight_logs
  DROP CONSTRAINT IF EXISTS weight_logs_bmi_check,
  DROP CONSTRAINT IF EXISTS weight_logs_visceral_fat_check,
  DROP CONSTRAINT IF EXISTS weight_logs_muscle_mass_check,
  DROP CONSTRAINT IF EXISTS weight_logs_bmr_check,
  DROP CONSTRAINT IF EXISTS weight_logs_metabolic_age_check,
  DROP CONSTRAINT IF EXISTS weight_logs_tsf_check;

ALTER TABLE public.weight_logs
  ADD CONSTRAINT weight_logs_bmi_check
    CHECK (bmi IS NULL OR bmi >= 0),
  ADD CONSTRAINT weight_logs_visceral_fat_check
    CHECK (visceral_fat IS NULL OR visceral_fat >= 0),
  ADD CONSTRAINT weight_logs_muscle_mass_check
    CHECK (muscle_mass IS NULL OR muscle_mass >= 0),
  ADD CONSTRAINT weight_logs_bmr_check
    CHECK (bmr IS NULL OR bmr >= 0),
  ADD CONSTRAINT weight_logs_metabolic_age_check
    CHECK (metabolic_age IS NULL OR metabolic_age >= 0),
  ADD CONSTRAINT weight_logs_tsf_check
    CHECK (tsf IS NULL OR tsf >= 0);

-- ---------------------------------------------------------------------------
-- Column documentation (COMMENT is naturally idempotent)
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.weight_logs.bmi IS 'Body Mass Index';
COMMENT ON COLUMN public.weight_logs.visceral_fat IS 'Visceral fat level/rating';
COMMENT ON COLUMN public.weight_logs.muscle_mass IS 'Muscle mass in kg';
COMMENT ON COLUMN public.weight_logs.bmr IS 'Basal Metabolic Rate in kcal/day';
COMMENT ON COLUMN public.weight_logs.metabolic_age IS 'Metabolic age in years';
COMMENT ON COLUMN public.weight_logs.tsf IS 'Triceps skinfold thickness in mm';
