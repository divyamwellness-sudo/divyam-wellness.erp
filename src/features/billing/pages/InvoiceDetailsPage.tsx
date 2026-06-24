import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddPaymentModal } from '@/features/billing/components/AddPaymentModal';
import { getInvoiceById } from '@/features/billing/services/invoice.service';
import type { CustomerType, InvoiceStatus, PaymentMethod, PricingTier } from '@/types/database.types';

const statusStyles: Record<InvoiceStatus, string> = {
  created: 'bg-slate-100 text-slate-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<InvoiceStatus, string> = {
  created: 'Created',
  partial: 'Partial',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const paymentMethodLabels: Record<PaymentMethod | 'other', string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

function formatCurrency(value: number): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatVP(value: number): string {
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} VP`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status]}`}>
      {statusLabels[status]}
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

export function InvoiceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoiceById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-slate-500">Loading invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div>
        <PageHeader title="Invoice Not Found" description="The requested invoice could not be loaded." />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">
            {error instanceof Error ? error.message : 'Invoice not found.'}
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/billing/invoices')}>
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const due = Number(invoice.due_amount);
  const canAddPayment = due > 0 && invoice.status !== 'cancelled';
  const payments = [...invoice.payments].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
  );

  return (
    <div>
      <PageHeader
        title={invoice.invoice_number}
        description={`Invoice date: ${formatDate(invoice.invoice_date)}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/billing/invoices')}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {canAddPayment && (
              <Button onClick={() => setIsPaymentModalOpen(true)}>
                <CreditCard className="h-4 w-4" />
                Add Payment
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Invoice header */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Invoice Number</p>
                <p className="text-xl font-semibold text-slate-900">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Invoice Date</p>
                <p className="text-sm text-slate-900">{formatDate(invoice.invoice_date)}</p>
              </div>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>

          {/* Customer information */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Customer</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-medium text-slate-900">{invoice.customer?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">{invoice.customer?.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Customer Type</p>
                <div className="mt-1">
                  <CustomerTypeBadge type={invoice.customer_type} />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Pricing Tier</p>
                <div className="mt-1">
                  <PricingTierBadge tier={invoice.pricing_tier} />
                </div>
              </div>
            </div>
          </div>

          {/* Invoice items */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">Items</h3>
            </div>
            {invoice.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No items on this invoice.</div>
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
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.product_sku}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-700">{item.quantity}</td>
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

          {/* Payment history */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700">Payment History</h3>
            </div>
            {payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No payments recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        Method
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {paymentMethodLabels[payment.payment_method as PaymentMethod] ?? payment.payment_method}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                          {formatCurrency(Number(payment.amount))}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {payment.reference_num || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(Number(invoice.subtotal))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tax</span>
                <span className="font-medium text-slate-900">{formatCurrency(Number(invoice.tax_amount))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total VP</span>
                <span className="font-medium text-orange-600">{formatVP(Number(invoice.total_vp))}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="font-semibold text-slate-900">Grand Total</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(Number(invoice.total_amount))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Paid Amount</span>
                <span className="font-medium text-green-600">{formatCurrency(Number(invoice.paid_amount))}</span>
              </div>
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  due > 0 && invoice.status !== 'cancelled' ? 'bg-red-50' : ''
                }`}
              >
                <span className="font-medium text-slate-700">Due Amount</span>
                <span
                  className={`font-semibold ${
                    due > 0 && invoice.status !== 'cancelled' ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(due)}
                </span>
              </div>
            </div>

            {canAddPayment && (
              <Button className="mt-6 w-full" onClick={() => setIsPaymentModalOpen(true)}>
                <CreditCard className="h-4 w-4" />
                Add Payment
              </Button>
            )}
          </div>
        </div>
      </div>

      <AddPaymentModal
        invoice={{
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          status: invoice.status,
          total_amount: invoice.total_amount,
          paid_amount: invoice.paid_amount,
          due_amount: invoice.due_amount,
        }}
        customerName={invoice.customer?.name}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />
    </div>
  );
}
