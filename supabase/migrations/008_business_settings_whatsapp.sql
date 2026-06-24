-- Divyam Wellness ERP — Settings: WhatsApp on business_settings
-- Fully idempotent.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

COMMENT ON COLUMN public.business_settings.whatsapp_number IS 'Business WhatsApp contact number';
