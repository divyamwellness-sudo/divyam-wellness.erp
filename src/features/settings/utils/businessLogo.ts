export const BUSINESS_LOGO_BUCKET = 'business-assets';

export const BUSINESS_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export const BUSINESS_LOGO_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const BUSINESS_LOGO_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

export type BusinessLogoValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validateBusinessLogoFile(file: File): BusinessLogoValidationResult {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!BUSINESS_LOGO_ALLOWED_EXTENSIONS.includes(extension as (typeof BUSINESS_LOGO_ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      message: 'Only PNG, JPG, JPEG, and WEBP files are allowed.',
    };
  }

  const mimeType = file.type.toLowerCase();
  if (
    mimeType &&
    !BUSINESS_LOGO_ALLOWED_MIME_TYPES.includes(mimeType as (typeof BUSINESS_LOGO_ALLOWED_MIME_TYPES)[number])
  ) {
    return {
      valid: false,
      message: 'Only PNG, JPG, JPEG, and WEBP files are allowed.',
    };
  }

  if (file.size > BUSINESS_LOGO_MAX_BYTES) {
    return {
      valid: false,
      message: 'Logo must be 5 MB or smaller.',
    };
  }

  return { valid: true };
}

export function getBusinessLogoStoragePath(extension: string): string {
  return `logos/business-logo.${extension}`;
}
