type CsvColumn<T> = {
  key: keyof T;
  header: string;
};

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportToCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  const headerLine = columns.map((col) => escapeCsvValue(col.header)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((col) => escapeCsvValue(row[col.key])).join(','),
  );
  const csv = [headerLine, ...bodyLines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
