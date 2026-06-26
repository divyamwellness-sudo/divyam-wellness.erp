import { useDocumentPrint } from '@/features/billing/utils/documentPrint';

/**
 * Backwards-compatible wrapper kept for the invoice print pipeline.
 * New code should prefer the shared `useDocumentPrint` hook directly.
 */
export function useInvoicePrint(
  contentRef: React.RefObject<HTMLDivElement | null>,
  documentTitle: string,
) {
  return useDocumentPrint(contentRef, documentTitle);
}
