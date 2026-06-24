import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StockInStatusBadge } from '@/features/inventory/components/StockInStatusBadge';
import type { StockInDetail } from '@/features/inventory/types';
import { formatDate } from '@/lib/utils/format';

type StockInDetailsModalProps = {
  stockIn: StockInDetail;
  isOpen: boolean;
  onClose: () => void;
};

export function StockInDetailsModal({ stockIn, isOpen, onClose }: StockInDetailsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-in-details-title"
        className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 id="stock-in-details-title" className="text-lg font-semibold text-slate-900">
              Stock In #{stockIn.reference_number}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{formatDate(stockIn.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Location</p>
              <p className="font-medium text-slate-900">{stockIn.location?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <div className="mt-1">
                <StockInStatusBadge status={stockIn.status} />
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500">Products</p>
              <p className="font-medium text-slate-900">{stockIn.products_count}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Quantity</p>
              <p className="font-medium text-slate-900">{stockIn.total_quantity}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Created By</p>
              <p className="font-medium text-slate-900">—</p>
            </div>
            {stockIn.reversed_at ? (
              <div>
                <p className="text-sm text-slate-500">Reversed At</p>
                <p className="font-medium text-slate-900">{formatDate(stockIn.reversed_at)}</p>
              </div>
            ) : null}
          </div>

          {stockIn.remarks ? (
            <div>
              <p className="text-sm text-slate-500">Remarks</p>
              <p className="text-sm text-slate-900">{stockIn.remarks}</p>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Qty
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {stockIn.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {line.product?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{line.product?.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900">{line.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
