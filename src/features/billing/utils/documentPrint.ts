import { useCallback, type RefObject } from 'react';
import { useReactToPrint } from 'react-to-print';

const printPageStyle = `
  @page {
    size: A4;
    margin: 12mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

/**
 * Shared print hook used by the invoice and quotation document pipelines.
 * Wraps `react-to-print` with the project's standard A4 page style.
 */
export function useDocumentPrint(
  contentRef: RefObject<HTMLDivElement | null>,
  documentTitle: string,
) {
  const print = useReactToPrint({
    contentRef,
    documentTitle,
    pageStyle: printPageStyle,
  });

  return useCallback(() => {
    print();
  }, [print]);
}
