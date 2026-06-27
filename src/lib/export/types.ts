import type { BusinessSettings } from '@/types';

/**
 * Shared export type system used by both the Excel and PDF engines so every
 * list page describes its data exactly once and gets both formats for free.
 */

export type ExportColumnType = 'text' | 'currency' | 'number' | 'date';

export type ExportColumn = {
  /** Key into each ExportRow. */
  key: string;
  /** Human-readable column header. */
  header: string;
  /** How the value should be formatted/aligned. Defaults to 'text'. */
  type?: ExportColumnType;
  /** Optional width hint (Excel: chars, PDF: mm). */
  width?: number;
  /** Optional explicit cell alignment. Overrides the type-based default. */
  align?: 'left' | 'right' | 'center';
};

export type ExportRow = Record<string, string | number | null | undefined>;

export type ExportOrientation = 'portrait' | 'landscape';

export type ExportOptions = {
  /** Centered report title, e.g. "Customers Report". */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Excel worksheet name (sanitized to ≤31 chars). Also used in filenames. */
  worksheetName: string;
  /** Base filename without extension. */
  filename: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  businessSettings: BusinessSettings | null;
  /** Display name of the user generating the report. */
  generatedBy?: string;
  /** PDF page orientation. Defaults to 'portrait'. */
  orientation?: ExportOrientation;
  /** Override the PDF table font size (mm-unit jsPDF points). Defaults to 9. */
  tableFontSize?: number;
};

const CURRENCY_NUMFMT = '"₹"#,##0.00;[Red]-"₹"#,##0.00';
const DATE_NUMFMT = 'dd-mm-yyyy';

export function currencyNumFmt(): string {
  return CURRENCY_NUMFMT;
}

export function dateNumFmt(): string {
  return DATE_NUMFMT;
}

/** Format a value for plain-text rendering (PDF cells, fallback). */
export function formatCellText(
  value: string | number | null | undefined,
  type: ExportColumnType,
): string {
  if (value == null || value === '') return '';
  switch (type) {
    case 'currency': {
      const num = Number(value);
      return Number.isFinite(num)
        ? `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(value);
    }
    case 'number': {
      const num = Number(value);
      return Number.isFinite(num) ? num.toLocaleString('en-IN') : String(value);
    }
    case 'date': {
      // Values are pre-formatted as dd-MMM-yyyy strings by the pages.
      return String(value);
    }
    default:
      return String(value);
  }
}
