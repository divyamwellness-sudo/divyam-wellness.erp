import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuotationForm } from '@/features/billing/components/QuotationForm';
import {
  getQuotationById,
  updateQuotation,
  type UpdateQuotationRequest,
} from '@/features/billing/services/quotation.service';

export function EditQuotationPage() {
  const { id } = useParams<{ id: string }>();
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

  const {
    data: quotation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => getQuotationById(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (request: UpdateQuotationRequest) => updateQuotation(id!, request),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      setToast(`Quotation ${updated.quotation_number} updated successfully`);
      navTimer.current = setTimeout(() => navigate(`/billing/quotations/${updated.id}`), 1000);
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update quotation. Please try again.',
      );
    },
  });

  const handleSubmit = async (request: UpdateQuotationRequest) => {
    setErrorMessage(null);
    try {
      await updateMutation.mutateAsync(request);
    } catch {
      // surfaced via onError
    }
  };

  const handleCancel = () => {
    if (id) {
      navigate(`/billing/quotations/${id}`);
    } else {
      navigate('/billing/quotations');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-slate-500">Loading quotation...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div>
        <PageHeader
          title="Quotation Not Found"
          description="The requested quotation could not be loaded."
        />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">
            {error instanceof Error ? error.message : 'Quotation not found.'}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/billing/quotations')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quotations
          </Button>
        </div>
      </div>
    );
  }

  if (quotation.status !== 'draft') {
    return (
      <div>
        <PageHeader
          title={quotation.quotation_number}
          description="This quotation cannot be edited."
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-amber-800">
            Only draft quotations can be edited. This quotation is currently{' '}
            <strong>{quotation.status}</strong>.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate(`/billing/quotations/${quotation.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quotation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Edit ${quotation.quotation_number}`}
        description="Update the draft quotation before sending it to the customer."
      />

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

      <QuotationForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={updateMutation.isPending}
        submitLabel="Save Changes"
        initialQuotation={quotation}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
