import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Download,
  Plus,
  CreditCard,
  IndianRupee,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryErrorAlert } from '@/components/shared/QueryErrorAlert';
import { RecordPaymentModal } from '@/features/billing/components/RecordPaymentModal';
import {
  getPaymentLedger,
  type PaymentLedgerFilters,
} from '@/features/billing/services/payment.service';
import { getInvoices } from '@/features/billing/services/invoice.service';
import { getCustomers } from '@/features/customers/services/customer.service';
import { exportToCsv } from '@/lib/utils/export';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate, toLocalDateInputValue, startOfLocalMonthInputValue } from '@/lib/utils/format';
import type { PaymentMethod } from '@/types/database.types';

const paymentMethodOptions: Array<{ value: PaymentMethod | 'all'; label: string }> = [
  { value: 'all', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Card' },
];

const paymentMethodLabels: Record<PaymentMethod | 'other', string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  card: 'Card',
  other: 'Other',
};

const statusStyles: Record<'created' | 'partial' | 'paid' | 'cancelled', string> = {
  created: 'bg-slate-100 text-slate-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<'created' | 'partial' | 'paid' | 'cancelled', string> = {
  created: 'Created',
  partial: 'Partial',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

type LedgerRow = {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_num: string | null;
  invoice_id: string;
  invoice_number: string;
  invoice_total: number;
  invoice_paid: number;
  invoice_due: number;
  invoice_status: 'created' | 'partial' | 'paid' | 'cancelled';
  customer_id: string;
  customer_name: string;
  customer_phone: string;
};

function SummaryCard({
  label,
  value,
  icon,
  accent,
  valueClassName = 'text-slate-900',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${valueClassName}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: LedgerRow['invoice_status'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        statusStyles[status]
      }`}
    >
      {statusLabels[status]}
    </span>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PaymentTable({
  payments,
  onRowClick,
}: {
  payments: LedgerRow[];
  onRowClick: (payment: LedgerRow) => void;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Wallet className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-4 text-slate-500">No active payments found.</p>
        <p className="mt-1 text-sm text-slate-400">
          Adjust your filters or record a new payment.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Payment Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Invoice #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Method
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Collected By
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {payments.map((payment) => (
              <tr
                key={payment.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onRowClick(payment)}
              >
                <td className="px-6 py-4 text-sm text-slate-700">
                  {formatDate(payment.payment_date)}
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-900">{payment.customer_name}</p>
                  <p className="text-xs text-slate-500">{payment.customer_phone}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-slate-900">
                    {payment.invoice_number}
                  </p>
                  <div className="mt-1">
                    <InvoiceStatusBadge status={payment.invoice_status} />
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  {paymentMethodLabels[payment.payment_method] ?? payment.payment_method}
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-400">
                  {/* Future-ready column: populated once collector tracking ships. */}
                  —
                </td>
                <td className="px-6 py-4 text-right text-xs text-slate-400">View →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PaymentsPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<PaymentLedgerFilters>({
    search: '',
    customerId: '',
    paymentMethod: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    data: ledgerData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['payments', 'ledger', filters],
    queryFn: () => getPaymentLedger(filters),
  });

  // Outstanding amount across all open invoices. The invoice service accepts
  // a single status per call, so we fetch "created" and "partial" separately
  // and combine them. This query is independent of the ledger filters so the
  // headline figure always reflects the business's true outstanding balance.
  const { data: openInvoicesData } = useQuery({
    queryKey: ['invoices', { status: 'created', forOutstanding: true }],
    queryFn: () => getInvoices({ status: 'created' }),
  });

  const { data: openInvoicesPartialData } = useQuery({
    queryKey: ['invoices', { status: 'partial', forOutstanding: true }],
    queryFn: () => getInvoices({ status: 'partial' }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', { status: 'all' }],
    queryFn: () => getCustomers({ status: 'all' }),
  });

  const payments = ledgerData?.payments ?? [];
  const customers = customersData?.customers ?? [];

  // Summary metrics — memoized so re-renders don't recompute.
  const summary = useMemo(() => {
    const today = toLocalDateInputValue();
    const monthStart = startOfLocalMonthInputValue();

    const paymentsToday = payments.filter((p) => p.payment_date === today);
    const paymentsThisMonth = payments.filter(
      (p) => p.payment_date >= monthStart && p.payment_date <= today,
    );

    const totalToday = paymentsToday.reduce((sum, p) => sum + p.amount, 0);
    const totalThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);
    const totalActive = payments.reduce((sum, p) => sum + p.amount, 0);

    const createdInvoices = openInvoicesData?.invoices ?? [];
    const partialInvoices = openInvoicesPartialData?.invoices ?? [];
    const outstanding = [...createdInvoices, ...partialInvoices].reduce(
      (sum, inv) => sum + Number(inv.due_amount),
      0,
    );

    return {
      totalToday,
      totalThisMonth,
      totalActive,
      outstanding,
      countToday: paymentsToday.length,
      countThisMonth: paymentsThisMonth.length,
      countActive: payments.length,
    };
  }, [payments, openInvoicesData, openInvoicesPartialData]);

  const customerFilterOptions = [
    { value: '', label: 'All Customers' },
    ...customers.map((customer) => ({ value: customer.id, label: customer.name })),
  ];

  const isFiltered =
    Boolean(filters.search?.trim()) ||
    Boolean(filters.customerId) ||
    (filters.paymentMethod && filters.paymentMethod !== 'all') ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo);

  const handleFilterChange = (key: keyof PaymentLedgerFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      customerId: '',
      paymentMethod: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  const handleRowClick = (payment: LedgerRow) => {
    if (payment.invoice_id) {
      navigate(`/billing/invoices/${payment.invoice_id}`);
    }
  };

  const handleExportCsv = () => {
    if (payments.length === 0) return;
    exportToCsv(
      payments.map((p) => ({
        payment_date: p.payment_date,
        customer_name: p.customer_name,
        customer_phone: p.customer_phone,
        invoice_number: p.invoice_number,
        invoice_status: p.invoice_status,
        payment_method: p.payment_method,
        amount: p.amount,
        reference_num: p.reference_num ?? '',
        invoice_total: p.invoice_total,
        invoice_due: p.invoice_due,
      })),
      [
        { key: 'payment_date', header: 'Payment Date' },
        { key: 'customer_name', header: 'Customer Name' },
        { key: 'customer_phone', header: 'Customer Phone' },
        { key: 'invoice_number', header: 'Invoice Number' },
        { key: 'invoice_status', header: 'Invoice Status' },
        { key: 'payment_method', header: 'Payment Method' },
        { key: 'amount', header: 'Amount' },
        { key: 'reference_num', header: 'Reference Number' },
        { key: 'invoice_total', header: 'Invoice Total' },
        { key: 'invoice_due', header: 'Outstanding Due' },
      ],
      `payments-ledger-${toLocalDateInputValue()}.csv`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="A live ledger of payments collected across all invoices."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={payments.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setIsRecordModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Payments Today"
          value={formatCurrency(summary.totalToday)}
          icon={<IndianRupee className="h-5 w-5 text-green-600" />}
          accent="bg-green-50"
          valueClassName="text-green-700"
        />
        <SummaryCard
          label="Payments This Month"
          value={formatCurrency(summary.totalThisMonth)}
          icon={<CreditCard className="h-5 w-5 text-brand-600" />}
          accent="bg-brand-50"
        />
        <SummaryCard
          label="Outstanding Amount"
          value={formatCurrency(summary.outstanding)}
          icon={<AlertCircle className="h-5 w-5 text-red-600" />}
          accent="bg-red-50"
          valueClassName="text-red-700"
        />
        <SummaryCard
          label="Total Active Payments"
          value={formatCurrency(summary.totalActive)}
          icon={<Wallet className="h-5 w-5 text-indigo-600" />}
          accent="bg-indigo-50"
        />
      </div>

      {/* Search + Filters */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="space-y-1 md:col-span-5">
            <label className="block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search customer, invoice #, amount or due (e.g. 2200)..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            label="Payment Method"
            value={filters.paymentMethod || 'all'}
            onChange={(value) => handleFilterChange('paymentMethod', value)}
            options={paymentMethodOptions as unknown as Array<{ value: string; label: string }>}
            className="md:col-span-3"
          />

          <Select
            label="Customer"
            value={filters.customerId || ''}
            onChange={(value) => handleFilterChange('customerId', value)}
            options={customerFilterOptions}
            className="md:col-span-4"
          />
        </div>

        {/* Collapsible date range + reset — collapses on mobile by default. */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 sm:hidden"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <Filter className="h-4 w-4" />
            {filtersOpen ? 'Hide date range' : 'Show date range'}
          </button>

          <div
            className={`grid gap-4 sm:grid-cols-2 ${filtersOpen ? 'block' : 'hidden'} sm:block sm:flex-1`}
          >
            <Input
              label="From Date"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
            <Input
              label="To Date"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          <Button variant="secondary" onClick={handleResetFilters} disabled={!isFiltered}>
            <Filter className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-slate-600">
          Showing {payments.length} active {payments.length === 1 ? 'payment' : 'payments'}
          {isFiltered ? ' (filtered)' : ''}
        </p>
      </div>

      {error && (
        <QueryErrorAlert
          message="Error loading payments. Please try again."
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading payments...</p>
        </div>
      )}

      {!isLoading && <PaymentTable payments={payments} onRowClick={handleRowClick} />}

      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => {
          // The modal already invalidates the ledger query; nothing else to do.
        }}
      />
    </div>
  );
}
