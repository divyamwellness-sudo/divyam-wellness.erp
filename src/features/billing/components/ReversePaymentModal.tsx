import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reversePayment } from '@/features/billing/services/payment.service';
import { paymentMethodLabels } from '@/features/billing/utils/invoiceDocument';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/format';
import type { Payment, PaymentMethod } from '@/types/database.types';

type ReversePaymentModalProps = {
  payment: Pick<Payment, 'id' | 'amount' | 'payment_date' | 'payment_method'>;
  invoiceId: string;
  invoiceNumber: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ReversePaymentModal({
  payment,
  invoiceId,
  invoiceNumber,
  isOpen,
  onClose,
  onSuccess,
}: ReversePaymentModalProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => reversePayment(payment.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['payments', invoiceId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to reverse payment. Please try again.',
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

  const methodLabel =
    paymentMethodLabels[payment.payment_method as PaymentMethod] ?? payment.payment_method;

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
        aria-labelledby="reverse-payment-title"
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="reverse-payment-title" className="text-lg font-semibold text-slate-900">
            Reverse Payment
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
            Reverse the {formatCurrency(Number(payment.amount))} payment on invoice{' '}
            <span className="font-medium text-slate-900">{invoiceNumber}</span>?
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Date</span>
              <span className="font-medium text-slate-900">{formatDate(payment.payment_date)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-slate-500">Method</span>
              <span className="font-medium text-slate-900">{methodLabel}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-slate-500">Amount</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(Number(payment.amount))}
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            The payment will be marked as reversed and an audit record will be created. Invoice
            paid and due amounts will be updated automatically.
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
            Reverse Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
