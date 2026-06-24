import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cancelInvoice } from '@/features/billing/services/invoice.service';

type CancelInvoiceModalProps = {
  invoiceId: string;
  invoiceNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CancelInvoiceModal({
  invoiceId,
  invoiceNumber,
  isOpen,
  onClose,
  onSuccess,
}: CancelInvoiceModalProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => cancelInvoice(invoiceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to cancel invoice. Please try again.',
      );
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
        aria-labelledby="cancel-invoice-title"
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="cancel-invoice-title" className="text-lg font-semibold text-slate-900">
            Cancel Invoice
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
            This will void the invoice. The invoice will remain visible as Cancelled and cannot
            receive new payments.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-900">{invoiceNumber}</p>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Keep Invoice
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
            Cancel Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
