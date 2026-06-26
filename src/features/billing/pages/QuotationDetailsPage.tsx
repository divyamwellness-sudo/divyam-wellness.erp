import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Pencil,
  Printer,
  Send,
  Trash2,
  XCircle,
  FileInput,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { QuotationDocument } from '@/features/billing/components/QuotationDocument';
import {
  convertQuotationToInvoice,
  deleteQuotation,
  duplicateQuotation,
  getQuotationById,
  updateQuotationStatus,
} from '@/features/billing/services/quotation.service';
import {
  getQuotationPdfFilename,
  quotationStatusLabels,
} from '@/features/billing/utils/quotationDocument';
import { downloadElementPdf } from '@/features/billing/utils/documentPdf';
import { useDocumentPrint } from '@/features/billing/utils/documentPrint';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getBusinessSettings } from '@/features/settings/services/settings.service';
import { formatCurrency, formatVP } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/format';
import type {
  CustomerType,
  PricingTier,
  QuotationStatus,
} from '@/types/database.types';

const statusStyles: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-indigo-100 text-indigo-700',
};

function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        statusStyles[status]
      }`}
    >
      {quotationStatusLabels[status]}
    </span>
  );
}

function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        type === 'coach' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
      }`}
    >
      {type === 'coach' ? 'Coach' : 'PC'}
    </span>
  );
}

function PricingTierBadge({ tier }: { tier: PricingTier }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
      {tier === 'MRP' ? 'MRP' : `${tier}%`}
    </span>
  );
}

export function QuotationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { businessSettings: authBusinessSettings } = useAuth();
  const documentRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const {
    data: quotation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => getQuotationById(id!),
    enabled: !!id,
  });

  const { data: fetchedBusinessSettings } = useQuery({
    queryKey: ['businessSettings'],
    queryFn: getBusinessSettings,
    enabled: !authBusinessSettings,
  });

  const businessSettings = authBusinessSettings ?? fetchedBusinessSettings ?? null;
  const canExportDocument = Boolean(quotation && businessSettings);
  const handlePrint = useDocumentPrint(documentRef, quotation?.quotation_number ?? 'Quotation');

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
    queryClient.invalidateQueries({ queryKey: ['quotation', id] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ qid, status }: { qid: string; status: QuotationStatus }) =>
      updateQuotationStatus(qid, status),
    onSuccess: () => {
      invalidateAll();
      showToast('Quotation status updated.');
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update status.');
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateQuotation,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      showToast(`Duplicated as ${created.quotation_number}.`);
      setTimeout(() => navigate(`/billing/quotations/${created.id}`), 800);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Failed to duplicate quotation.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      showToast('Draft quotation deleted.');
      setTimeout(() => navigate('/billing/quotations'), 800);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'Failed to delete quotation.');
    },
  });

  const handleConvert = async () => {
    if (!quotation) return;
    const confirm = window.confirm(
      `Convert ${quotation.quotation_number} into an invoice? Inventory will be deducted and the quotation will be marked as converted.`,
    );
    if (!confirm) return;

    setActionError(null);
    setIsConverting(true);
    try {
      const result = await convertQuotationToInvoice(quotation.id);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      showToast('Quotation converted to invoice. Opening invoice...');
      setTimeout(() => navigate(`/billing/invoices/${result.invoice_id}`), 1000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to convert quotation.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!documentRef.current || !quotation) {
      setActionError('Quotation document is not ready.');
      return;
    }

    setActionError(null);
    setIsGeneratingPdf(true);
    try {
      await downloadElementPdf(
        documentRef.current,
        getQuotationPdfFilename(quotation.quotation_number),
      );
    } catch {
      setActionError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintClick = () => {
    if (!canExportDocument) {
      setActionError('Configure business settings before printing.');
      return;
    }
    setActionError(null);
    handlePrint();
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

  const isDraft = quotation.status === 'draft';
  const isConverted = quotation.status === 'converted';
  const canChangeStatus = !isConverted;

  return (
    <div>
      <PageHeader
        title={quotation.quotation_number}
        description={`Quotation date: ${formatDate(quotation.quotation_date)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/billing/quotations')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              variant="secondary"
              onClick={handlePrintClick}
              disabled={!canExportDocument}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleDownloadPdf()}
              disabled={!canExportDocument || isGeneratingPdf}
            >
              <Download className="h-4 w-4" />
              {isGeneratingPdf ? 'Generating PDF…' : 'Download PDF'}
            </Button>
            {isDraft && (
              <Button variant="secondary" onClick={() => navigate(`/billing/quotations/${quotation.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => duplicateMutation.mutate(quotation.id)}
              disabled={duplicateMutation.isPending}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>
            <Button
              onClick={handleConvert}
              disabled={isConverting || isConverted}
              isLoading={isConverting}
            >
              <FileInput className="h-4 w-4" />
              {isConverted ? 'Converted' : 'Convert to Invoice'}
            </Button>
            {isDraft && (
              <Button
                variant="danger"
                onClick={() => {
                  const confirm = window.confirm(
                    `Delete draft quotation ${quotation.quotation_number}? This cannot be undone.`,
                  );
                  if (confirm) {
                    void deleteMutation.mutateAsync(quotation.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete Draft
              </Button>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
          <button
            type="button"
            className="ml-3 text-xs font-medium text-red-600 hover:text-red-800"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Quotation Number</p>
                <p className="text-xl font-semibold text-slate-900">
                  {quotation.quotation_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Quotation Date</p>
                <p className="text-sm text-slate-900">
                  {formatDate(quotation.quotation_date)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Valid Until</p>
                <p className="text-sm text-slate-900">{formatDate(quotation.valid_until)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Stock Location</p>
                <p className="text-sm text-slate-900">
                  {quotation.stock_location?.name ?? '—'}
                </p>
              </div>
              <QuotationStatusBadge status={quotation.status} />
            </div>

            {quotation.converted_invoice && (
              <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
                Converted to invoice{' '}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={() =>
                    navigate(`/billing/invoices/${quotation.converted_invoice!.id}`)
                  }
                >
                  {quotation.converted_invoice.invoice_number}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Customer</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-medium text-slate-900">
                  {quotation.customer?.name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">
                  {quotation.customer?.phone ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Customer Type</p>
                <div className="mt-1">
                  <CustomerTypeBadge type={quotation.customer_type} />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Pricing Tier</p>
                <div className="mt-1">
                  <PricingTierBadge tier={quotation.pricing_tier} />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">Items</h3>
            </div>
            {quotation.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No items on this quotation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        Product
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                        Qty
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                        Line Total
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                        VP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {quotation.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-slate-500">{item.product_sku}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-700">
                          {formatCurrency(Number(item.unit_price))}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                          {formatCurrency(Number(item.line_total))}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-orange-600">
                          {formatVP(Number(item.line_vp))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {quotation.terms && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Terms &amp; Conditions
              </h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{quotation.terms}</p>
            </div>
          )}

          {quotation.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Notes</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{quotation.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(Number(quotation.subtotal))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(Number(quotation.tax_amount))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total VP</span>
                  <span className="font-medium text-orange-600">
                    {formatVP(Number(quotation.total_vp))}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-900">Grand Total</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(Number(quotation.total_amount))}
                  </span>
                </div>
              </div>
            </div>

            {canChangeStatus && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Status Actions</h3>
                <p className="mb-4 text-xs text-slate-500">
                  Update the quotation status as the customer responds.
                </p>
                <div className="grid gap-2">
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        statusMutation.mutate({ qid: quotation.id, status: 'sent' })
                      }
                      disabled={statusMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                      Mark as Sent
                    </Button>
                  )}
                  {quotation.status === 'sent' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        statusMutation.mutate({ qid: quotation.id, status: 'draft' })
                      }
                      disabled={statusMutation.isPending}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Revert to Draft
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      statusMutation.mutate({ qid: quotation.id, status: 'accepted' })
                    }
                    disabled={statusMutation.isPending || quotation.status === 'accepted'}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Accepted
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      statusMutation.mutate({ qid: quotation.id, status: 'rejected' })
                    }
                    disabled={statusMutation.isPending || quotation.status === 'rejected'}
                  >
                    <XCircle className="h-4 w-4" />
                    Mark Rejected
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      statusMutation.mutate({ qid: quotation.id, status: 'expired' })
                    }
                    disabled={statusMutation.isPending || quotation.status === 'expired'}
                  >
                    <Ban className="h-4 w-4" />
                    Mark Expired
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <FileText className="h-4 w-4" />
                <p className="text-sm font-medium">
                  Quotations do not affect inventory, payments or revenue.
                </p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Stock is deducted only when this quotation is converted into an invoice.
              </p>
            </div>
          </div>
        </div>
      </div>

      {businessSettings && (
        <div className="fixed left-[-9999px] top-0 -z-50 overflow-hidden" aria-hidden="true">
          <QuotationDocument
            ref={documentRef}
            quotation={quotation}
            businessSettings={businessSettings}
          />
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
