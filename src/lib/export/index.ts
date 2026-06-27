/**
 * Shared Export Engine entry point.
 *
 * The heavy runtime dependencies (exceljs for Excel, jsPDF + autotable for PDF)
 * are intentionally dynamic-imported inside the wrappers below so they are
 * split into separate chunks and only loaded the first time a user triggers
 * an export — keeping the main application bundle small and fast.
 *
 * Pages import only the types (erased at compile time) plus these async
 * wrappers, so adding exports to a list page adds zero weight to its initial
 * load.
 */
export type {
  ExportColumn,
  ExportRow,
  ExportOptions,
  ExportColumnType,
  ExportOrientation,
  formatCellText,
  currencyNumFmt,
  dateNumFmt,
} from './types';
export { ExportDropdown } from '@/components/shared/ExportDropdown';
import type { ExportOptions } from './types';

export async function exportToExcel(options: ExportOptions): Promise<void> {
  const { exportToExcel: impl } = await import('./excelExport');
  return impl(options);
}

export async function exportToPdfReport(options: ExportOptions): Promise<void> {
  const { exportToPdfReport: impl } = await import('./pdfReport');
  return impl(options);
}
