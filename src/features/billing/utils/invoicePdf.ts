import { downloadElementPdf } from '@/features/billing/utils/documentPdf';

/**
 * Backwards-compatible wrapper kept for the invoice export pipeline.
 * New code should prefer the shared `downloadElementPdf` helper directly.
 */
export async function downloadInvoicePdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  return downloadElementPdf(element, filename);
}
