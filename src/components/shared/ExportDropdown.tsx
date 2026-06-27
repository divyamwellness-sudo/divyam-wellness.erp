import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';

type ExportDropdownProps = {
  onExportExcel: () => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
  disabled?: boolean;
  /** Compact label used inside the trigger button. */
  label?: string;
  className?: string;
};

/**
 * Shared "Export ▼" dropdown used on every list page.
 * Offers only Excel (.xlsx) and PDF — CSV is intentionally NOT available
 * anywhere in the ERP per the export system spec.
 */
export function ExportDropdown({
  onExportExcel,
  onExportPdf,
  disabled = false,
  label = 'Export',
  className,
}: ExportDropdownProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  async function run(exportFn: () => void | Promise<void>) {
    if (disabled || isWorking) return;
    setIsOpen(false);
    setIsWorking(true);
    try {
      await exportFn();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || isWorking}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
      >
        <Download className="h-4 w-4" />
        {label}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
        />
      </Button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Export options"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={isWorking}
            onClick={() => void run(onExportExcel)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel (.xlsx)
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={isWorking}
            onClick={() => void run(onExportPdf)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileText className="h-4 w-4 text-red-600" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
