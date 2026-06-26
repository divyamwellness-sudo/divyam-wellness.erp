import type { QuotationWithDetails } from '@/features/billing/services/quotation.service';
import type { BusinessSettings } from '@/types/database.types';
import type { QuotationStatus } from '@/types/database.types';

export type QuotationDocumentProps = {
  quotation: QuotationWithDetails;
  businessSettings: BusinessSettings;
};

export const quotationStatusLabels: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

export function getQuotationPdfFilename(quotationNumber: string): string {
  const safeName = quotationNumber.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safeName || 'quotation'}.pdf`;
}
