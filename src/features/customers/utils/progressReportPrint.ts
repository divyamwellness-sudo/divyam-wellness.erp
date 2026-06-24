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

export function useProgressReportPrint(
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
