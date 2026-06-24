import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';
import { ReverseStockInModal } from '@/features/inventory/components/ReverseStockInModal';
import { StockInDetailsModal } from '@/features/inventory/components/StockInDetailsModal';
import { StockInStatusBadge } from '@/features/inventory/components/StockInStatusBadge';
import { getStockInById, getStockInHistory } from '@/features/inventory/services/inventory.service';
import type { StockInHistoryRow } from '@/features/inventory/types';
import { formatDate } from '@/lib/utils/format';

export function StockInHistoryPanel() {
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [reversingBatch, setReversingBatch] = useState<StockInHistoryRow | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: history = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'stock-in-history'],
    queryFn: getStockInHistory,
  });

  const {
    data: viewingDetail,
    isLoading: isLoadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ['inventory', 'stock-in', viewingBatchId],
    queryFn: () => getStockInById(viewingBatchId!),
    enabled: Boolean(viewingBatchId),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Stock In History</h3>
        <p className="mt-1 text-sm text-slate-500">
          View posted stock in documents and reverse entire transactions when needed.
        </p>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {error && (
        <QueryErrorAlert message="Failed to load stock in history." onRetry={() => void refetch()} />
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Loading stock in history...
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          No stock in transactions recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Reference No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Products
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Total Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.reference_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.location?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900">{row.products_count}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-900">{row.total_quantity}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">—</td>
                    <td className="px-4 py-3">
                      <StockInStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingBatchId(row.id)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        {row.status === 'POSTED' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setReversingBatch(row)}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Reverse
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingBatchId && viewingDetail && !isLoadingDetail && !detailError && (
        <StockInDetailsModal
          stockIn={viewingDetail}
          isOpen={Boolean(viewingBatchId)}
          onClose={() => setViewingBatchId(null)}
        />
      )}

      {viewingBatchId && detailError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load stock in details.
        </div>
      )}

      {reversingBatch && (
        <ReverseStockInModal
          batchId={reversingBatch.id}
          referenceNumber={reversingBatch.reference_number}
          isOpen={Boolean(reversingBatch)}
          onClose={() => setReversingBatch(null)}
          onSuccess={() => {
            setReversingBatch(null);
            setSuccessMessage(`Stock in ${reversingBatch.reference_number} reversed successfully.`);
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
}
