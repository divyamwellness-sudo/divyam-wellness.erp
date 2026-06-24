import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reverseStockIn } from '@/features/inventory/services/inventory.service';

type ReverseStockInModalProps = {
  batchId: string;
  referenceNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ReverseStockInModal({
  batchId,
  referenceNumber,
  isOpen,
  onClose,
  onSuccess,
}: ReverseStockInModalProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => reverseStockIn(batchId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reverse stock in.');
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, mutation.isPending, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!mutation.isPending) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reverse-stock-in-title"
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="reverse-stock-in-title" className="text-lg font-semibold text-slate-900">
            Reverse Stock In
          </h3>
          <button
            type="button"
            onClick={() => !mutation.isPending && onClose()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            Reverse Stock In #{referenceNumber}?
          </p>
          <p className="mt-3 text-sm text-slate-600">
            This will create reversing inventory transactions and restore stock balances.
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={mutation.isPending}
            onClick={() => {
              setErrorMessage(null);
              mutation.mutate();
            }}
          >
            Reverse Stock In
          </Button>
        </div>
      </div>
    </div>
  );
}
