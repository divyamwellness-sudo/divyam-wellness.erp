-- Divdev ERP — Business logo URL + storage bucket
-- Safe to run multiple times (idempotent).
-- Note: requested as 014_business_logo.sql; numbered 018 because 014 is inventory.

-- ===========================================================================
-- 1. business_settings.logo_url
-- ===========================================================================
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ===========================================================================
-- 2. Storage bucket: business-assets
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-assets',
  'business-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ===========================================================================
-- 3. Storage policies (public read, admin write)
-- ===========================================================================
DROP POLICY IF EXISTS "business_assets_select_public" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_delete_admin" ON storage.objects;

CREATE POLICY "business_assets_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-assets');

CREATE POLICY "business_assets_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-assets'
    AND public.is_erp_admin()
  );

CREATE POLICY "business_assets_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND public.is_erp_admin()
  )
  WITH CHECK (
    bucket_id = 'business-assets'
    AND public.is_erp_admin()
  );

CREATE POLICY "business_assets_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND public.is_erp_admin()
  );
