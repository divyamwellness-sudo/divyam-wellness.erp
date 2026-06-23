import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { InvoiceForm } from '@/features/billing/components/InvoiceForm';
import { createInvoice, type CreateInvoiceRequest } from '@/features/billing/services/invoice.service';

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navTimer.current) {
        clearTimeout(navTimer.current);
      }
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      setToast(`Invoice ${invoice.invoice_number} created successfully`);
      navTimer.current = setTimeout(() => navigate('/billing/invoices'), 1200);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create invoice. Please try again.');
    },
  });

  const handleSubmit = async (request: CreateInvoiceRequest) => {
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync(request);
    } catch {
      // Error surfaced via the mutation's onError handler / banner.
    }
  };

  const handleCancel = () => {
    navigate('/billing/invoices');
  };

  return (
    <div>
      <PageHeader title="Create Invoice" description="Create a new customer invoice." />

      {errorMessage && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      <InvoiceForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={createMutation.isPending}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
