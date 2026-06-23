import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  Filter,
  Receipt,
  IndianRupee,
  AlertCircle,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { getInvoices, type InvoiceFilters } from '@/features/billing/services/invoice.service';
import { getCustomers } from '@/features/customers/services/customer.service';
import type { Invoice, InvoiceStatus } from '@/types/database.types';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'created', label: 'Created' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

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

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      </div>
    </div>
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

function InvoiceTable({
  invoices,
  customerLabel,
  onView,
}: {
  invoices: Invoice[];
  customerLabel: (customerId: string) => { name: string; phone: string } | null;
  onView: (invoice: Invoice) => void;
}) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <Receipt className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-4 text-slate-500">No invoices found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Total</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Paid</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Due</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {invoices.map((invoice) => {
              const customer = customerLabel(invoice.customer_id);
              const hasDue = Number(invoice.due_amount) > 0 && invoice.status !== 'cancelled';

              return (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{invoice.invoice_number}</td>
                  <td className="px-6 py-4">
                    {customer ? (
                      <div className="text-sm">
                        <p className="text-slate-900">{customer.name}</p>
                        <p className="text-slate-500">{customer.phone}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <InvoiceStatusBadge status={invoice.status} />
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                    {formatCurrency(invoice.total_amount)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-700">
                    {formatCurrency(invoice.paid_amount)}
                  </td>
                  <td
                    className={`px-6 py-4 text-right text-sm font-semibold ${
                      hasDue ? 'bg-red-50 text-red-600' : 'text-slate-400'
                    }`}
                  >
                    {formatCurrency(invoice.due_amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{formatDate(invoice.invoice_date)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onView(invoice)}>
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<InvoiceFilters>({
    status: 'all',
    customerId: '',
    search: '',
  });

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const {
    data: invoicesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => getInvoices(filters),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', { status: 'all' }],
    queryFn: () => getCustomers({ status: 'all' }),
  });

  const invoices = invoicesData?.invoices || [];
  const customers = customersData?.customers || [];

  const customerLabel = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer ? { name: customer.name, phone: customer.phone } : null;
  };

  const customerFilterOptions = [
    { value: '', label: 'All Customers' },
    ...customers.map((customer) => ({
      value: customer.id,
      label: `${customer.name} (${customer.phone})`,
    })),
  ];

  // Summary metrics (cancelled invoices excluded from financial totals).
  const activeInvoices = invoices.filter((invoice) => invoice.status !== 'cancelled');
  const totalRevenue = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const totalDue = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.due_amount), 0);
  const totalVP = activeInvoices.reduce((sum, invoice) => sum + Number(invoice.total_vp), 0);

  const handleFilterChange = (key: keyof InvoiceFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleCreateInvoice = () => {
    navigate('/billing/invoices/new');
  };

  const handleViewInvoice = (invoice: Invoice) => {
    showToast(`Viewing invoice ${invoice.invoice_number} is coming soon.`);
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="View and manage customer invoices, payments and due balances."
        action={
          <Button onClick={handleCreateInvoice}>
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Invoices"
          value={invoices.length.toLocaleString('en-IN')}
          icon={<Receipt className="h-5 w-5 text-brand-600" />}
          accent="bg-brand-50"
        />
        <SummaryCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={<IndianRupee className="h-5 w-5 text-green-600" />}
          accent="bg-green-50"
        />
        <SummaryCard
          label="Total Due"
          value={formatCurrency(totalDue)}
          icon={<AlertCircle className="h-5 w-5 text-red-600" />}
          accent="bg-red-50"
        />
        <SummaryCard
          label="Total VP"
          value={formatVP(totalVP)}
          icon={<Award className="h-5 w-5 text-orange-600" />}
          accent="bg-orange-50"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by invoice number..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            label="Status"
            value={filters.status || 'all'}
            onChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
            options={statusOptions}
          />

          <Select
            label="Customer"
            value={filters.customerId || ''}
            onChange={(value) => handleFilterChange('customerId', value)}
            options={customerFilterOptions}
          />

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setFilters({ status: 'all', customerId: '', search: '' })}
            >
              <Filter className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4">
        <p className="text-sm text-slate-600">Showing {invoices.length} invoices</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p>Error loading invoices. Please try again.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-slate-500">Loading invoices...</p>
        </div>
      )}

      {/* Invoice Table */}
      {!isLoading && (
        <InvoiceTable invoices={invoices} customerLabel={customerLabel} onView={handleViewInvoice} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
