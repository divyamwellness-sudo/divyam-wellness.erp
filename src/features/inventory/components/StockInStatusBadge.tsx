import type { StockInStatus } from '@/features/inventory/types';

const statusStyles: Record<StockInStatus, string> = {
  POSTED: 'bg-green-100 text-green-700',
  REVERSED: 'bg-slate-100 text-slate-600',
};

const statusLabels: Record<StockInStatus, string> = {
  POSTED: 'Posted',
  REVERSED: 'Reversed',
};

export function StockInStatusBadge({ status }: { status: StockInStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
